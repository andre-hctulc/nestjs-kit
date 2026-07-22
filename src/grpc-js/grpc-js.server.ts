import { type CustomTransportStrategy, Server, Transport } from "@nestjs/microservices";
import grpc, { Metadata, type ServiceDefinition, type UntypedHandleCall } from "@grpc/grpc-js";
import { Logger } from "@nestjs/common";
import {
    isWritableCall,
    mapHttpStatus,
    type AnyGrpcCall,
    type AnyGrpcCallback,
    type WritableGrpcCall,
} from "./grpc.util.js";
import { firstValueFrom, isObservable } from "rxjs";
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

interface GrpcCallTimeoutOptions {
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

interface GrpcJsServerOptions {
    address?: string;
    serverOptions?: grpc.ServerOptions;
    services?: Record<string, ServiceDefinition>;
    timeouts?: GrpcCallTimeoutOptions;
}

type GrpcJsServerEventMap = {
    listening: (address: string) => void;
    error: (error: unknown) => void;
    close: () => void;
};

type GrpcJsServerEventType = string & keyof GrpcJsServerEventMap;
type GrpcMessageHandler = (...args: any[]) => any;

export class GrpcJsServer extends Server<GrpcJsServerEventMap, string> implements CustomTransportStrategy {
    #logger = new Logger(GrpcJsServer.name);

    override readonly transportId = Transport.GRPC;

    #server: grpc.Server;
    #address: string;
    #options: GrpcJsServerOptions;
    #eventListeners: Map<GrpcJsServerEventType, Set<(...args: any[]) => any>> = new Map();

    constructor(options: GrpcJsServerOptions = {}) {
        super();
        this.#address = options.address ?? "0.0.0.0:50051";
        this.#server = new grpc.Server(options.serverOptions);
        this.#options = options;
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
            this.#server.bindAsync(this.#address, grpc.ServerCredentials.createInsecure(), (err) => {
                if (err) {
                    this.#dispatchEvent("error", err);
                    reject(err);
                    return;
                }

                resolve();
            });
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
            const state = { closed: false };
            const timeoutController = new TimeoutController(this.#resolveCallTimeouts(call, responseStream));

            try {
                // Nest microservice handlers are already wrapped by context creators.
                // For gRPC patterns they expect (payload, metadata, call).
                const result = await timeoutController.race(
                    Promise.resolve(
                        // Match nest grpc microservice handler signature: (payload, metadata, call)
                        handler(
                            // Value of switchToRpc().getData()
                            data,
                            // Value of switchToRpc().getContext()
                            metadata,
                            // Value of RpcParamtype.GRPC_CALL (3rd RPC argument)
                            call,
                        ),
                    ),
                );

                if (responseStream) {
                    if (!writableCall) {
                        throw new Error("Streaming response expected writable gRPC call");
                    }
                    await this.#writeStreamingResult(result, writableCall, state, timeoutController);
                    state.closed = true;
                    return;
                }

                const resolvedResult = await this.#resolveMaybeAsync(result, timeoutController);

                if (state.closed || timeoutController.isExpired()) {
                    return;
                }

                if (callback) {
                    state.closed = true;
                    callback(null, resolvedResult);
                    return;
                }

                if (!writableCall) {
                    state.closed = true;
                    return;
                }

                if (resolvedResult !== undefined) {
                    writableCall.write(resolvedResult);
                }
                state.closed = true;
                writableCall.end();
            } catch (err) {
                if (state.closed) {
                    return;
                }
                state.closed = true;
                this.#emitGrpcError(call, callback, err);
            } finally {
                timeoutController.dispose();
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

    async #writeStreamingResult(
        result: unknown,
        call: WritableGrpcCall,
        state: { closed: boolean },
        timeoutController: TimeoutController,
    ): Promise<void> {
        if (isObservable(result)) {
            await timeoutController.race(
                new Promise<void>((resolve, reject) => {
                    const subscription = result.subscribe({
                        next: (value) => {
                            if (state.closed || timeoutController.isExpired()) {
                                subscription.unsubscribe();
                                return;
                            }

                            timeoutController.touch();
                            call.write?.(value);
                        },
                        error: (err) => {
                            subscription.unsubscribe();
                            reject(err);
                        },
                        complete: () => {
                            subscription.unsubscribe();
                            resolve();
                        },
                    });

                    timeoutController.race(Promise.resolve()).catch(() => {
                        subscription.unsubscribe();
                    });
                }),
            );

            if (state.closed || timeoutController.isExpired()) {
                return;
            }
            call.end?.();
            return;
        }

        if (isAsyncIterable(result)) {
            for await (const value of this.#iterateWithTimeout(result, timeoutController)) {
                if (state.closed || timeoutController.isExpired()) {
                    return;
                }

                timeoutController.touch();
                call.write?.(value);
            }

            if (state.closed || timeoutController.isExpired()) {
                return;
            }
            call.end?.();
            return;
        }

        if (state.closed || timeoutController.isExpired()) {
            return;
        }

        if (result !== undefined) {
            call.write?.(result);
        }
        call.end?.();
    }

    #emitGrpcError(call: AnyGrpcCall, callback: AnyGrpcCallback | undefined, err: unknown): void {
        const grpcErr = this.#toGrpcError(err);

        if (callback) {
            callback(grpcErr);
            return;
        }

        call.emit?.("error", grpcErr);
    }

    async #resolveMaybeAsync<T>(value: T | Promise<T>, timeoutController?: TimeoutController): Promise<T> {
        if (isObservable(value)) {
            return (await this.#firstValueFromObservable(value, timeoutController)) as T;
        }

        const pending = Promise.resolve(value);
        return timeoutController ? await timeoutController.race(pending) : await pending;
    }

    async #firstValueFromObservable<T>(
        observable: unknown,
        timeoutController?: TimeoutController,
    ): Promise<T> {
        const source = observable as Parameters<typeof firstValueFrom>[0];

        if (!timeoutController) {
            return (await firstValueFrom(source)) as T;
        }

        return await timeoutController.race(
            new Promise<T>((resolve, reject) => {
                const subscription = source.subscribe({
                    next: (value) => {
                        subscription.unsubscribe();
                        resolve(value as T);
                    },
                    error: (err) => {
                        subscription.unsubscribe();
                        reject(err);
                    },
                    complete: () => {
                        subscription.unsubscribe();
                        reject(new Error("Observable completed without emitting a value"));
                    },
                });

                timeoutController.race(Promise.resolve()).catch(() => {
                    subscription.unsubscribe();
                });
            }),
        );
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

    #resolveCallTimeouts(call: AnyGrpcCall, responseStream: boolean): CallTimeouts {
        const timeouts = this.#options.timeouts ?? {};
        const clientDeadlineMs = this.#getClientDeadlineTimeoutMs(call);

        const defaultTotalTimeoutMs = normalizeTimeout(
            responseStream ? timeouts.defaultStreamTimeout : timeouts.defaultUnaryTimeout,
        );
        const maxTotalTimeoutMs = normalizeTimeout(
            responseStream ? timeouts.maxStreamTimeout : timeouts.maxUnaryTimeout,
        );

        // Deadline precedence:
        // 1) Client deadline (when present)
        // 2) Server default timeout fallback
        // 3) Server max timeout as final safety cap
        const requestedTotalTimeoutMs = clientDeadlineMs ?? defaultTotalTimeoutMs;
        const totalTimeoutMs = capTimeout(
            requestedTotalTimeoutMs,
            maxTotalTimeoutMs ?? (responseStream ? MAX_STREAM_TIMEOUT : MAX_UNARY_TIMEOUT),
        );

        return { totalTimeoutMs };
    }

    #getClientDeadlineTimeoutMs(call: AnyGrpcCall): number | undefined {
        const deadline = call.getDeadline?.();
        if (deadline === undefined || deadline === Infinity) {
            return undefined;
        }

        const deadlineAt = deadline instanceof Date ? deadline.getTime() : deadline;
        if (!Number.isFinite(deadlineAt)) {
            return undefined;
        }

        return Math.max(0, deadlineAt - Date.now());
    }

    #toGrpcError(err: unknown): Error {
        if (err instanceof Error && typeof (err as any).code === "number") {
            return err;
        }

        const details = (err as any)?.details;
        const message = (err as any)?.message ?? "Internal server error";
        const httpStatusCode = typeof details?.httpStatusCode === "number" ? details.httpStatusCode : 500;

        const mapped = Object.assign(new Error(message), {
            code: mapHttpStatus(httpStatusCode),
            details: details ? JSON.stringify(details) : JSON.stringify({ message }),
        });

        if (details) {
            const metadata = new Metadata();
            metadata.set("x-error-details", JSON.stringify(details));
            (mapped as any).metadata = metadata;
        }

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
