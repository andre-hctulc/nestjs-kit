import type { CustomTransportStrategy } from "@nestjs/microservices";
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
import { isAsyncIterable } from "../rpc/rpc.util.js";
import { unwrapBySchema, wrapBySchema } from "./value.util.js";
import {
    firstValueFromObservable,
    raceWithSignal,
    resolveFinalTimeout,
} from "../common/util/system/system.util.js";
import { getConnectClientDeadline } from "./connect.util.js";

interface ConnectRpcServerOptions {
    address?: string;
    services?: DescService[];
    timeout?: number;
    maxTimeout?: number;
    serverOptions?: ServerOptions;
    adapterOptions?: Partial<ConnectNodeAdapterOptions>;
}

type MessageHandler = (...args: any[]) => any;

/** 2min in milliseconds */
const DEFAULT_TIMEOUT = 120_000;

/** Maximum connect call deadline in milliseconds (24 hours) */
const MAX_TIMEOUT = 24 * 60 * 60 * 1000;

const createServerTimeoutInterceptor: (timeout: number, maxTimeout: number) => Interceptor = (
    timeout: number,
    maxTimeout: number,
) => {
    return (next) => async (req) => {
        const clientDeadline = getConnectClientDeadline(req.header);
        const finalTimeout = resolveFinalTimeout(clientDeadline, timeout, maxTimeout);
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

    #options: ConnectRpcServerOptions;
    #address: string;
    #server: http2.Http2Server | undefined;

    constructor(options: ConnectRpcServerOptions = {}) {
        super();
        this.#address = options.address ?? "0.0.0.0:50051";
        this.#options = options;
    }

    override unwrap<T>(): T {
        return this.#server as T;
    }

    async listen(callback: () => void) {
        try {
            const interceptor = createServerTimeoutInterceptor(
                this.#options.timeout ?? DEFAULT_TIMEOUT,
                this.#options.maxTimeout ?? MAX_TIMEOUT,
            );
            const handler = connectNodeAdapter({
                ...this.#options.adapterOptions,
                routes: (router) => this.#registerServices(router),
                interceptors: [interceptor, ...(this.#options.adapterOptions?.interceptors ?? [])],
            });

            const [host, portStr] = this.#address.split(":");
            const port = parseInt(portStr, 10);

            await new Promise<void>((resolve, reject) => {
                this.#server = http2.createServer(this.#options.serverOptions || {}, handler);
                this.#server.once("error", (err) => {
                    reject(err);
                });
                this.#server.listen(port, host, resolve);
            });
        } catch (err) {
            throw err;
        }

        callback();
    }

    close() {
        this.#server?.close();
        this.#server = undefined;
    }

    #registerServices(router: ConnectRouter) {
        for (const serviceDesc of this.#options.services ?? []) {
            const impl: Record<string, any> = {};

            for (const method of serviceDesc.methods) {
                const candidates = this.#patternCandidates(
                    serviceDesc.typeName,
                    method.localName,
                    method.name,
                );
                const handler = this.#resolveMessageHandler(candidates);

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
                    const result = await raceWithSignal(
                        handler(normalizedReq, ctx.requestHeader, ctx),
                        signal,
                    );

                    if (isAsyncIterable(result)) {
                        for await (const value of self.#iterateWithSignal(result, signal)) {
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

                const result = await handler(normalizedReq, ctx.requestHeader, ctx);
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

    async *#iterateWithSignal(
        iterable: AsyncIterable<unknown>,
        signal: AbortSignal,
    ): AsyncGenerator<unknown, void, void> {
        const iterator = iterable[Symbol.asyncIterator]();

        try {
            while (true) {
                const next = await raceWithSignal(iterator.next(), signal);
                if (next.done) {
                    return;
                }
                yield next.value;
            }
        } finally {
            await iterator.return?.();
        }
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

    #patternCandidates(serviceName: string, localName: string, protoName: string): unknown[] {
        return [
            { service: serviceName, method: localName },
            { service: serviceName, method: protoName },
            `${serviceName}.${localName}`,
            `${serviceName}.${protoName}`,
            { cmd: `${serviceName}.${localName}` },
            { cmd: `${serviceName}.${protoName}` },
            localName,
            protoName,
        ];
    }

    #resolveMessageHandler(candidates: unknown[]): MessageHandler | null {
        for (const candidate of candidates) {
            const key = this.normalizePattern(candidate as any);
            const handler = this.getHandlerByPattern(this.getRouteFromPattern(key));
            if (handler) return handler;
        }
        return null;
    }

    #toConnectError(err: any): ConnectError {
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

        // connect error
        if (err instanceof ConnectError) {
            return err;
        }

        const message = err?.message || "Internal server error";
        const details = (err as any)?.details || {};
        const code: number = Number.isInteger(err?.code)
            ? (err.code as number)
            : Number.isInteger(details?.rpcStatusCode)
              ? (details.rpcStatusCode as number)
              : Code.Internal;
        const outgoingDetails = this.#toOutgoingDetails(details);

        return new ConnectError(message, code, undefined, outgoingDetails, err);
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
