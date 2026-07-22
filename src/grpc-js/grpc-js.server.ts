import { type CustomTransportStrategy, Server, Transport } from "@nestjs/microservices";
import {
    Server as GrpcServer,
    Metadata,
    type ServiceDefinition,
    type UntypedHandleCall,
    status,
    type ServerInterceptor,
    type ServerOptions,
    ServerInterceptingCall,
    ServerCredentials,
} from "@grpc/grpc-js";
import { Logger } from "@nestjs/common";
import {
    isWritableCall,
    type AnyGrpcCall,
    type AnyGrpcCallback,
    type WritableGrpcCall,
} from "./grpc.util.js";
import { isObservable } from "rxjs";
import { isAsyncIterable } from "../rpc/rpc.util.js";
import {
    createAbortError,
    firstValueFromObservable,
    raceWithSignal,
    resolveFinalTimeout,
} from "../common/util/system/system.util.js";

/** 2min in milliseconds */
const DEFAULT_TIMEOUT = 120_000;

/** Maximum gRPC call deadline in milliseconds (24 hours) */
const MAX_TIMEOUT = 24 * 60 * 60 * 1000;

interface GrpcJsServerOptions {
    address?: string;
    serverOptions?: ServerOptions;
    services?: Record<string, ServiceDefinition>;
    timeout?: number;
    maxTimeout?: number;
    credentials?: ServerCredentials;
}

type GrpcJsServerEventMap = {
    listening: (address: string) => void;
    error: (error: unknown) => void;
    close: () => void;
};

type GrpcJsServerEventType = string & keyof GrpcJsServerEventMap;
type GrpcMessageHandler = (...args: any[]) => any;

function createTimeoutInterceptor(timeout: number, maxTimeout: number): ServerInterceptor {
    return (_methodDescriptor, call) => {
        const deadline = call.getDeadline?.();
        const finalTimeout = resolveFinalTimeout(deadline, timeout, maxTimeout);

        const timer = setTimeout(() => {
            call.sendStatus({
                code: status.DEADLINE_EXCEEDED,
                details: `Deadline exceeded after ${finalTimeout}ms`,
            });
        }, finalTimeout);

        const clearTimer = () => {
            clearTimeout(timer);
        };

        return new ServerInterceptingCall(call, {
            start: (next) => {
                next({
                    onCancel: () => {
                        clearTimer();
                    },
                });
            },
            sendStatus: (statusObject, next) => {
                clearTimer();
                next(statusObject);
            },
        });
    };
}

export class GrpcJsServer extends Server<GrpcJsServerEventMap, string> implements CustomTransportStrategy {
    #logger = new Logger(GrpcJsServer.name);

    override readonly transportId = Transport.GRPC;

    #server: GrpcServer;
    #address: string;
    #options: GrpcJsServerOptions;
    #eventListeners: Map<GrpcJsServerEventType, Set<(...args: any[]) => any>> = new Map();

    constructor(options: GrpcJsServerOptions = {}) {
        super();
        this.#address = options.address ?? "0.0.0.0:50051";
        this.#options = options;

        const timeoutInterceptor = createTimeoutInterceptor(
            this.#options.timeout ?? DEFAULT_TIMEOUT,
            this.#options.maxTimeout ?? MAX_TIMEOUT,
        );
        const serverOptions: ServerOptions = {
            ...(options.serverOptions ?? {}),
            interceptors: [timeoutInterceptor, ...(options.serverOptions?.interceptors ?? [])],
        };

        this.#server = new GrpcServer(serverOptions);
    }

    override unwrap<T>(): T {
        return this.#server as T;
    }

    async listen(callback: () => void) {
        try {
            this.#registerServices();
        } catch (err) {
            this.#dispatchEvent("error", err);
            throw err;
        }

        await new Promise<void>((resolve, reject) => {
            this.#server.bindAsync(
                this.#address,
                this.#options.credentials ?? ServerCredentials.createInsecure(),
                (err) => {
                    if (err) {
                        this.#dispatchEvent("error", err);
                        reject(err);
                        return;
                    }

                    resolve();
                },
            );
        });

        callback();
        this.#dispatchEvent("listening", this.#address);
    }

    close() {
        this.#server.forceShutdown();
        this.#dispatchEvent("close");
        this.#eventListeners.clear();
    }

    #registerServices() {
        for (const [serviceName, serviceDef] of Object.entries(this.#options.services ?? {})) {
            const impl: Record<string, UntypedHandleCall> = {};

            for (const [method, def] of Object.entries(serviceDef) as Array<
                [string, { path?: string; responseStream?: boolean }]
            >) {
                const patternCandidates = this.#patternCandidates(serviceName, method, def.path);
                const handler = this.#resolveMessageHandler(patternCandidates);

                if (!handler) {
                    this.#logger.warn(
                        `Skipping gRPC method registration: no MessagePattern handler found for ${serviceName}.${method}`,
                    );
                    continue;
                }

                impl[method] = this.#handle(handler, !!def.responseStream);
                this.#logger.log(`Registered gRPC method [MessagePattern].${serviceName}.${method}`);
            }

            this.#server.addService(serviceDef, impl);
        }
    }

    #handle(handler: GrpcMessageHandler, responseStream: boolean): UntypedHandleCall {
        return async (...args: any[]) => {
            const call: AnyGrpcCall = args[0];
            const callback: AnyGrpcCallback | undefined = typeof args[1] === "function" ? args[1] : undefined;
            const data = "request" in call ? call.request : args[0];
            const metadata = call.metadata instanceof Metadata ? call.metadata : new Metadata();
            const writableCall = isWritableCall(call) ? call : null;

            const abortController = new AbortController();
            const signal = abortController.signal;

            const eventfulCall = call as {
                cancelled?: boolean;
                once: (event: string, listener: () => void) => void;
                on: (event: string, listener: () => void) => void;
                off?: (event: string, listener: () => void) => void;
                removeListener?: (event: string, listener: () => void) => void;
            };

            const onCancelled = () => {
                abortController.abort(createAbortError("Request was cancelled by the client"));
            };

            const onClose = () => {
                abortController.abort(createAbortError("Request was closed"));
            };

            eventfulCall.once("cancelled", onCancelled);
            eventfulCall.once("close", onClose);

            if (call.cancelled) {
                onCancelled();
            }

            try {
                // Nest microservice handlers are already wrapped by context creators.
                // For gRPC patterns they expect (payload, metadata, call).
                const result = await raceWithSignal(Promise.resolve(handler(data, metadata, call)), signal);

                if (responseStream) {
                    if (!writableCall) {
                        throw new Error("Streaming response expected writable gRPC call");
                    }
                    await this.#writeStreamingResult(result, writableCall, signal);
                    return;
                }

                const resolvedResult = await this.#resolveMaybeAsync(result, signal);

                if (signal.aborted) {
                    return;
                }

                if (callback) {
                    callback(null, resolvedResult);
                    return;
                }

                if (!writableCall) {
                    return;
                }

                if (resolvedResult !== undefined) {
                    writableCall.write(resolvedResult);
                }
                writableCall.end();
            } catch (err) {
                this.#emitGrpcError(call, callback, err);
            } finally {
                eventfulCall.off?.("cancelled", onCancelled);
                eventfulCall.off?.("close", onClose);
                eventfulCall.removeListener?.("cancelled", onCancelled);
                eventfulCall.removeListener?.("close", onClose);
            }
        };
    }

    #patternCandidates(serviceName: string, methodName: string, path?: string): unknown[] {
        const candidates: unknown[] = [
            { service: serviceName, method: methodName },
            `${serviceName}.${methodName}`,
            { cmd: `${serviceName}.${methodName}` },
            methodName,
        ];

        if (path) {
            candidates.push(path);
        }

        return candidates;
    }

    #resolveMessageHandler(candidates: unknown[]): GrpcMessageHandler | null {
        for (const candidate of candidates) {
            const key = this.normalizePattern(candidate as any);
            const handler = this.getHandlerByPattern(this.getRouteFromPattern(key));
            if (handler) {
                return handler;
            }
        }

        return null;
    }

    async #writeStreamingResult(result: unknown, call: WritableGrpcCall, signal: AbortSignal): Promise<void> {
        if (isObservable(result)) {
            for await (const value of this.#observableToIterable(result, signal)) {
                signal.throwIfAborted();
                call.write?.(value);
            }
            signal.throwIfAborted();
            call.end?.();
            return;
        }

        if (isAsyncIterable(result)) {
            for await (const value of this.#iterateWithSignal(result, signal)) {
                signal.throwIfAborted();
                call.write?.(value);
            }
            signal.throwIfAborted();
            call.end?.();
            return;
        }

        signal.throwIfAborted();

        if (result !== undefined) {
            call.write?.(result);
        }
        call.end?.();
    }

    #emitGrpcError(call: AnyGrpcCall, callback: AnyGrpcCallback | undefined, err: unknown): void {
        if (call.cancelled) {
            return;
        }

        const grpcErr = this.#toGrpcError(err);

        if (callback) {
            callback(grpcErr);
            return;
        }

        call.emit?.("error", grpcErr);
    }

    async #resolveMaybeAsync<T>(value: T | Promise<T>, signal: AbortSignal): Promise<T> {
        if (isObservable(value)) {
            return await firstValueFromObservable(value, signal);
        }

        return await raceWithSignal(Promise.resolve(value), signal);
    }

    async *#iterateWithSignal(
        iterable: AsyncIterable<unknown>,
        signal: AbortSignal,
    ): AsyncGenerator<unknown> {
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

    async *#observableToIterable(observable: unknown, signal: AbortSignal): AsyncGenerator<unknown> {
        const buffer: unknown[] = [];
        let notify: (() => void) | null = null;
        let error: unknown = null;
        let complete = false;

        const onAbort = () => {
            notify?.();
            notify = null;
        };

        signal.addEventListener("abort", onAbort, { once: true });

        const subscription = (observable as any).subscribe({
            next: (value: unknown) => {
                buffer.push(value);
                notify?.();
                notify = null;
            },
            error: (err: unknown) => {
                error = err;
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
                if (error) {
                    throw error;
                }
                if (complete) {
                    return;
                }

                await new Promise<void>((resolve) => {
                    notify = resolve;
                });
            }
        } finally {
            signal.removeEventListener("abort", onAbort);
            subscription.unsubscribe();
        }
    }

    #toGrpcError(err: any): Error {
        if (err?.name === "TimeoutError") {
            return Object.assign(new Error(err.message || "Deadline exceeded"), {
                code: status.DEADLINE_EXCEEDED,
                details: err.message || "Deadline exceeded",
                metadata: new Metadata(),
            });
        }

        if (err?.name === "AbortError") {
            return Object.assign(new Error(err.message || "Request canceled"), {
                code: status.CANCELLED,
                details: err.message || "Request canceled",
                metadata: new Metadata(),
            });
        }

        // grpc error
        if (err instanceof Error && typeof (err as any).code === "number") {
            return err;
        }

        const message = err?.message ?? "Internal server error";
        const details = err?.details || {};
        const code = Number.isInteger(err?.code)
            ? (err.code as number)
            : Number.isInteger(details?.rpcStatusCode)
              ? (details.rpcStatusCode as number)
              : status.INTERNAL;

        const metadata = new Metadata();
        const detailsJson = JSON.stringify(details);
        metadata.set("x-error-details", detailsJson);

        const mapped = Object.assign(new Error(message), {
            code,
            details: detailsJson,
            metadata,
        });

        return mapped;
    }

    override on<
        E extends GrpcJsServerEventType = GrpcJsServerEventType,
        H extends GrpcJsServerEventMap[E] = GrpcJsServerEventMap[E],
    >(event: E, listener: H): void {
        if (!this.#eventListeners.has(event)) {
            this.#eventListeners.set(event, new Set());
        }
        this.#eventListeners.get(event)?.add(listener);
    }

    off<E extends GrpcJsServerEventType = GrpcJsServerEventType>(
        event: E,
        listener: (...args: any[]) => any,
    ): this {
        const listeners = this.#eventListeners.get(event);
        if (listeners) {
            listeners.delete(listener);
        }

        return this;
    }

    #dispatchEvent<EventKey extends GrpcJsServerEventType>(
        event: EventKey,
        ...args: Parameters<GrpcJsServerEventMap[EventKey]>
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
