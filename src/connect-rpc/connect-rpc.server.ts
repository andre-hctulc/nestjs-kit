import type { CustomTransportStrategy } from "@nestjs/microservices";
import { Server } from "@nestjs/microservices";
import { Logger } from "@nestjs/common";
import { ConnectError, Code, type ConnectRouter, type HandlerContext } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { fromJson, type DescService, type JsonValue } from "@bufbuild/protobuf";
import { StructSchema } from "@bufbuild/protobuf/wkt";
import http2, { type ServerOptions } from "node:http2";
import { isObservable, firstValueFrom } from "rxjs";
import {
    capTimeout,
    normalizeTimeout,
    TimeoutController,
    type CallTimeouts,
} from "../common/util/system/timeout.util.js";
import { isAsyncIterable } from "../rpc/rpc.util.js";

/** 5min in milliseconds */
const MAX_UNARY_TIMEOUT = 300_000;

/** 10min in milliseconds */
const MAX_STREAM_TIMEOUT = 600_000;

interface ConnectTimeoutOptions {
    /** Default timeout for unary calls in milliseconds */
    defaultUnaryTimeout?: number;
    /**
     * Maximum timeout for unary calls in milliseconds
     * @default 5min
     */
    maxUnaryTimeout?: number;
    /** Default timeout for stream calls in milliseconds */
    defaultStreamTimeout?: number;
    /**
     * Maximum timeout for stream calls in milliseconds
     * @default 10min
     */
    maxStreamTimeout?: number;
}

interface ConnectRpcServerOptions {
    address?: string;
    services?: DescService[];
    timeouts?: ConnectTimeoutOptions;
    serverOptions?: ServerOptions;
}

type ConnectServerEventMap = {
    listening: (address: string) => void;
    error: (error: unknown) => void;
    close: () => void;
};

type ConnectServerEventType = string & keyof ConnectServerEventMap;
type MessageHandler = (...args: any[]) => any;

export class ConnectRpcServer extends Server<ConnectServerEventMap, string> implements CustomTransportStrategy {
    #logger = new Logger(ConnectRpcServer.name);
    #options: ConnectRpcServerOptions;
    #address: string;
    #server: http2.Http2Server | null = null;
    #eventListeners: Map<ConnectServerEventType, Set<(...args: any[]) => any>> = new Map();

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
            const handler = connectNodeAdapter({
                routes: (router) => this.#registerServices(router),
            });

            const [host, portStr] = this.#address.split(":");
            const port = parseInt(portStr, 10);

            await new Promise<void>((resolve, reject) => {
                this.#server = http2.createServer(this.#options.serverOptions || {}, handler as any);
                this.#server.once("error", (err) => {
                    this.#dispatchEvent("error", err);
                    reject(err);
                });
                this.#server.listen(port, host, resolve);
            });
        } catch (err) {
            this.#dispatchEvent("error", err);
            throw err;
        }

        callback();
        this.#dispatchEvent("listening", this.#address);
    }

    close() {
        this.#server?.close();
        this.#server = null;
        this.#dispatchEvent("close");
        this.#eventListeners.clear();
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
                impl[method.localName] = this.#handle(handler, isStreaming);
                this.#logger.log(
                    `Registered Connect method [MessagePattern].${serviceDesc.typeName}.${method.localName}`,
                );
            }

            router.service(serviceDesc, impl);
        }
    }

    #handle(handler: MessageHandler, responseStream: boolean) {
        if (responseStream) {
            const self = this;
            return async function* (req: any, ctx: HandlerContext): AsyncGenerator<any> {
                const timeoutController = new TimeoutController(self.#resolveCallTimeouts(responseStream));

                try {
                    ctx.signal.throwIfAborted();
                    const result = await timeoutController.race(
                        Promise.resolve(handler(req, ctx.requestHeader, ctx)),
                    );

                    if (isAsyncIterable(result)) {
                        for await (const value of self.#iterateWithTimeout(result, timeoutController)) {
                            ctx.signal.throwIfAborted();
                            if (timeoutController.isExpired()) return;
                            yield value;
                        }
                        return;
                    }

                    if (isObservable(result)) {
                        yield* self.#observableToIterable(result, timeoutController);
                        return;
                    }

                    if (result !== undefined) {
                        yield result;
                    }
                } catch (err) {
                    throw self.#toConnectError(err);
                } finally {
                    timeoutController.dispose();
                }
            };
        }

        return async (req: any, ctx: HandlerContext) => {
            const timeoutController = new TimeoutController(this.#resolveCallTimeouts(responseStream));

            try {
                ctx.signal.throwIfAborted();
                const result = await timeoutController.race(
                    Promise.resolve(handler(req, ctx.requestHeader, ctx)),
                );
                return await this.#resolveMaybeAsync(result, timeoutController);
            } catch (err) {
                throw this.#toConnectError(err);
            } finally {
                timeoutController.dispose();
            }
        };
    }

    async *#iterateWithTimeout(
        iterable: AsyncIterable<unknown>,
        timeoutController: TimeoutController,
    ): AsyncGenerator<unknown, void, void> {
        const iterator = iterable[Symbol.asyncIterator]();

        try {
            while (true) {
                const next = await timeoutController.race(iterator.next());
                if (next.done) {
                    return;
                }

                yield next.value;
            }
        } finally {
            await iterator.return?.();
        }
    }

    async #resolveMaybeAsync(value: unknown, timeoutController?: TimeoutController): Promise<unknown> {
        if (isObservable(value)) {
            return timeoutController
                ? await timeoutController.race(firstValueFrom(value as Parameters<typeof firstValueFrom>[0]))
                : await firstValueFrom(value as Parameters<typeof firstValueFrom>[0]);
        }
        return value;
    }

    async *#observableToIterable(observable: any, timeoutController: TimeoutController): AsyncGenerator<any> {
        const buffer: any[] = [];
        let notify: (() => void) | null = null;
        let error: unknown = null;
        let complete = false;

        const subscription = observable.subscribe({
            next: (v: any) => {
                buffer.push(v);
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
                if (buffer.length > 0) {
                    yield buffer.shift();
                    continue;
                }
                if (error) throw error;
                if (complete) return;
                if (timeoutController.isExpired()) return;
                await timeoutController.race(
                    new Promise<void>((r) => {
                        notify = r;
                    }),
                );
            }
        } finally {
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

    #resolveCallTimeouts(responseStream: boolean): CallTimeouts {
        const timeouts = this.#options.timeouts ?? {};
        const defaultTimeoutMs = normalizeTimeout(
            responseStream ? timeouts.defaultStreamTimeout : timeouts.defaultUnaryTimeout,
        );
        const maxTimeoutMs = normalizeTimeout(
            responseStream ? timeouts.maxStreamTimeout : timeouts.maxUnaryTimeout,
        );

        const requestedTimeoutMs = defaultTimeoutMs;
        const totalTimeoutMs = capTimeout(
            requestedTimeoutMs,
            maxTimeoutMs ?? (responseStream ? MAX_STREAM_TIMEOUT : MAX_UNARY_TIMEOUT),
        );

        return { totalTimeoutMs };
    }

    #toConnectError(err: unknown): ConnectError {
        if (err instanceof ConnectError) {
            return err;
        }

        const details = (err as any)?.details;
        const message = (err as any)?.message || "Internal server error";
        const httpStatusCode = typeof details?.httpStatusCode === "number" ? details.httpStatusCode : 500;
        const outgoingDetails = this.#toOutgoingDetails(details);

        return new ConnectError(
            message,
            this.#mapHttpToCode(httpStatusCode),
            undefined,
            outgoingDetails,
            err,
        );
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

    #mapHttpToCode(httpStatusCode: number): Code {
        switch (httpStatusCode) {
            case 400:
                return Code.InvalidArgument;
            case 401:
                return Code.Unauthenticated;
            case 403:
                return Code.PermissionDenied;
            case 404:
                return Code.NotFound;
            case 409:
                return Code.AlreadyExists;
            case 429:
                return Code.ResourceExhausted;
            case 499:
                return Code.Canceled;
            case 501:
                return Code.Unimplemented;
            case 503:
                return Code.Unavailable;
            default:
                return Code.Internal;
        }
    }

    override on<
        E extends ConnectServerEventType = ConnectServerEventType,
        H extends ConnectServerEventMap[E] = ConnectServerEventMap[E],
    >(event: E, listener: H): void {
        if (!this.#eventListeners.has(event)) {
            this.#eventListeners.set(event, new Set());
        }
        this.#eventListeners.get(event)?.add(listener);
    }

    off<E extends ConnectServerEventType = ConnectServerEventType>(
        event: E,
        listener: (...args: any[]) => any,
    ): this {
        const listeners = this.#eventListeners.get(event);
        if (listeners) {
            listeners.delete(listener);
        }

        return this;
    }

    #dispatchEvent<EventKey extends ConnectServerEventType>(
        event: EventKey,
        ...args: Parameters<ConnectServerEventMap[EventKey]>
    ): void {
        const listeners = this.#eventListeners.get(event);
        if (!listeners) {
            return;
        }

        for (const listener of listeners) {
            try {
                listener(...args);
            } catch (err) {
                this.#logger.error(`Error in event listener for event "${event}":`, err);
            }
        }
    }
}
