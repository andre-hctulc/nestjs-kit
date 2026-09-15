import type { CustomTransportStrategy, MsPattern } from "@nestjs/microservices";
import { Server, Transport } from "@nestjs/microservices";
import { Logger } from "@nestjs/common";
import {
    ConnectError,
    Code,
    type ConnectRouter,
    type HandlerContext,
    type Interceptor,
} from "@connectrpc/connect";
import { connectNodeAdapter, type ConnectNodeAdapterOptions } from "@connectrpc/connect-node";
import {
    fromJson,
    type DescField,
    type DescMessage,
    type DescService,
    type JsonValue,
} from "@bufbuild/protobuf";
import { StructSchema } from "@bufbuild/protobuf/wkt";
import http2, { type ServerOptions } from "node:http2";
import { isObservable } from "rxjs";
import { unwrapBySchema, wrapBySchema } from "./value.util.js";
import {
    capitalize,
    decapitalize,
    firstValueFromObservable,
    isAsyncGenerator,
    isAsyncIterable,
    isGenerator,
    iterateWithSignal,
    raceWithSignal,
    resolveFinalTimeout,
} from "../common/util/system/system.util.js";
import { getConnectClientDeadline, normalizeConnectPattern } from "./connect-system.util.js";
import { mapToGrpcStatusCode } from "../common/index.js";
import { normalizeGrpcPattern } from "../grpc-js/grpc-system.util.js";

export interface ConnectRpcServerConfig {
    address: string;
    service: DescService | DescService[];
    timeout?: number;
    serverOptions?: ServerOptions;
    adapterOptions?: Partial<ConnectNodeAdapterOptions>;
}

type MessageHandler = ((...args: any[]) => any) & { isEventHandler?: boolean };

/** 2min in milliseconds */
const DEFAULT_TIMEOUT = 120_000;

/** Maximum connect call deadline in milliseconds (24 hours) */
const MAX_TIMEOUT = 24 * 60 * 60 * 1000;

export interface ConnectRpcMethodPattern {
    service?: string;
    method: string;
}

const createServerTimeoutInterceptor: (timeout: number) => Interceptor = (timeout: number) => {
    return (next) => async (req) => {
        const clientDeadline = getConnectClientDeadline(req.header);
        const finalTimeout = resolveFinalTimeout(clientDeadline, timeout, MAX_TIMEOUT);
        const serverSignal = AbortSignal.timeout(finalTimeout);
        const combined = req.signal ? AbortSignal.any([req.signal, serverSignal]) : serverSignal;
        return next({ ...req, signal: combined });
    };
};

export class ConnectRpcServer
    extends Server<Record<string, (...args: any[]) => any>, string>
    implements CustomTransportStrategy
{
    #logger = new Logger(ConnectRpcServer.name);

    override readonly transportId = Transport.GRPC;

    #config: ConnectRpcServerConfig;
    #address: string;
    #server: http2.Http2Server | undefined;
    #desc: DescService[];
    constructor(config: ConnectRpcServerConfig) {
        super();
        this.#address = config.address ?? "0.0.0.0:50051";
        this.#config = config;
        this.#desc = Array.isArray(config.service) ? config.service : config.service ? [config.service] : [];
        if (!this.#desc.length) {
            this.#logger.warn("No Connect service descriptors provided. No methods will be registered.");
        }
    }

    override unwrap<T>(): T {
        return this.#server as T;
    }

    #listening = false;
    async listen(callback: () => void) {
        if (this.#listening) {
            throw new Error("Listen already attempted");
        }
        this.#listening = true;

        const interceptor = createServerTimeoutInterceptor(this.#config.timeout ?? DEFAULT_TIMEOUT);
        const handler = connectNodeAdapter({
            ...this.#config.adapterOptions,
            routes: (router) => this.#registerServices(router),
            interceptors: [interceptor, ...(this.#config.adapterOptions?.interceptors ?? [])],
        });

        const [host, portStr] = this.#address.split(":");
        const port = parseInt(portStr, 10);

        await new Promise<void>((resolve, reject) => {
            this.#server = http2.createServer(this.#config.serverOptions || {}, handler);
            this.#server.once("error", (err) => {
                reject(err);
            });
            this.#server.listen(port, host, resolve);
        });

        callback();
    }

    close() {
        this.#server?.close();
        this.#server = undefined;
    }

    protected override normalizePattern(pattern: MsPattern): string {
        return JSON.stringify(normalizeConnectPattern(pattern));
    }

    #getDefaultService(): string | undefined {
        return this.#desc.length ? this.#desc[0].name : undefined;
    }

    #getHandlerByPattern(pattern: MsPattern): MessageHandler | undefined {
        const normalizedPattern = normalizeConnectPattern(pattern);
        const p1 = {
            service: normalizedPattern.service,
            method: normalizedPattern.method,
        };

        const h1 = this.getHandlerByPattern(this.normalizePattern(p1 as MsPattern));
        if (h1) {
            return h1;
        }

        const defaultService = this.#getDefaultService();
        if (p1.service === defaultService) {
            const h2 = this.getHandlerByPattern(
                this.normalizePattern({ service: undefined, method: p1.method } as any),
            );
            if (h2) {
                return h2;
            }
        }

        return undefined;
    }

    #registerServices(router: ConnectRouter) {
        for (const serviceDesc of this.#desc) {
            const impl: Record<string, any> = {};

            for (const method of serviceDesc.methods) {
                const handler = this.#getHandlerByPattern({
                    service: serviceDesc.name,
                    method: method.localName,
                });

                if (!handler) {
                    this.#logger.warn(
                        `Skipping Connect method: no MessagePattern handler found for ${serviceDesc.typeName}.${method.localName}`,
                    );
                    continue;
                }

                const isStreaming =
                    method.methodKind === "server_streaming" || method.methodKind === "bidi_streaming";
                impl[method.localName] = this.#handle(handler, isStreaming, method.input, method.output);
                this.#logger.log(
                    `Registered Connect method [MessagePattern].${serviceDesc.typeName}.${method.localName}`,
                );
            }

            router.service(serviceDesc, impl);
        }
    }

    #handle(handler: MessageHandler, responseStream: boolean, inputSchema: DescMessage, outputSchema: any) {
        if (responseStream) {
            const self = this;
            return async function* (req: any, ctx: HandlerContext): AsyncGenerator<any> {
                const signal = ctx.signal;
                const normalizedReq = self.#unwrapRequest(req, inputSchema);

                try {
                    const result = await raceWithSignal(handler(normalizedReq, ctx), signal);

                    if (isAsyncGenerator(result) || isGenerator(result)) {
                        for await (const value of iterateWithSignal(result, signal)) {
                            yield wrapBySchema(value, outputSchema);
                        }
                        return;
                    }

                    if (isObservable(result)) {
                        yield* self.#observableToIterable(result, outputSchema, signal);
                        return;
                    }

                    if (result !== undefined) {
                        yield wrapBySchema(result, outputSchema);
                    }
                } catch (err) {
                    throw self.#toConnectError(err);
                }
            };
        }

        return async (req: any, ctx: HandlerContext) => {
            const normalizedReq = this.#unwrapRequest(req, inputSchema);

            try {
                ctx.signal.throwIfAborted();

                const result = await handler(normalizedReq, ctx);
                ctx.signal.throwIfAborted();

                let resolved = await result;
                if (isObservable(resolved)) {
                    resolved = await firstValueFromObservable(resolved, ctx.signal);
                }

                ctx.signal.throwIfAborted();

                return wrapBySchema(resolved, outputSchema);
            } catch (err) {
                throw this.#toConnectError(err);
            }
        };
    }

    #unwrapRequest(value: unknown, schema: DescMessage): unknown {
        if (isAsyncIterable(value)) {
            return this.#unwrapAsyncIterable(value, schema);
        }

        return unwrapBySchema(value, schema);
    }

    async *#unwrapAsyncIterable(
        iterable: AsyncIterable<unknown>,
        schema: DescMessage,
    ): AsyncGenerator<unknown> {
        for await (const item of iterable) {
            yield unwrapBySchema(item, schema);
        }
    }

    async *#observableToIterable(
        observable: any,
        schema: DescMessage | DescField | undefined,
        signal: AbortSignal,
    ): AsyncGenerator<any> {
        const buffer: any[] = [];
        let notify: (() => void) | null = null;
        let error: unknown = null;
        let complete = false;

        const onAbort = () => {
            notify?.();
            notify = null;
        };

        signal.addEventListener("abort", onAbort, { once: true });

        const subscription = observable.subscribe({
            next: (v: any) => {
                buffer.push(wrapBySchema(v, schema));
                notify?.();
                notify = null;
            },
            error: (e: unknown) => {
                error = e;
                notify?.();
                notify = null;
            },
            complete: () => {
                complete = true;
                notify?.();
                notify = null;
            },
        });

        try {
            while (true) {
                signal.throwIfAborted();

                if (buffer.length > 0) {
                    yield buffer.shift();
                    continue;
                }
                if (error) throw error;
                if (complete) return;

                await new Promise<void>((resolve) => {
                    notify = resolve;
                });
            }
        } finally {
            signal.removeEventListener("abort", onAbort);
            subscription.unsubscribe();
        }
    }

    #toConnectError(err: any): ConnectError {
        if (err instanceof ConnectError) {
            return err;
        }

        if (err?.name === "TimeoutError") {
            return new ConnectError(err.message, Code.DeadlineExceeded, undefined, undefined, err);
        }

        if (err?.name === "AbortError") {
            return new ConnectError(
                err.message || "Request canceled",
                Code.Canceled,
                undefined,
                undefined,
                err,
            );
        }

        const message = err?.message || "Internal connect rpc service error";
        const details = err.details && typeof err.details === "object" ? err.details : {};
        const statusCode = mapToGrpcStatusCode(err.statusCode);
        const outgoingDetails = this.#toOutgoingDetails(details);

        return new ConnectError(message, statusCode, undefined, outgoingDetails, err);
    }

    #toOutgoingDetails(details: unknown) {
        if (!details || typeof details !== "object" || Array.isArray(details)) {
            return undefined;
        }
        try {
            const structDetail = fromJson(StructSchema, details as JsonValue);
            return [{ desc: StructSchema, value: structDetail }];
        } catch {
            return undefined;
        }
    }

    override on(event: string, listener: (...args: any[]) => any): void {
        this.#server?.on(event, listener);
    }

    off(event: string, listener: (...args: any[]) => any): this {
        this.#server?.off(event, listener);
        return this;
    }
}
