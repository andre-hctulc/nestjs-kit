import { ClientProxy, type MsPattern, type ReadPacket, type WritePacket } from "@nestjs/microservices";
import { createClient, type CallOptions, type Transport } from "@connectrpc/connect";
import type { DescService } from "@bufbuild/protobuf";
import type { ConnectTransportOptions } from "@connectrpc/connect-node";
import { connectable, defer, mergeMap, Observable, Subject } from "rxjs";

export interface ClientConnectRpcConfig {
    transport: { customTransport: Transport } | ConnectTransportOptions;
    services: DescService | DescService[];
}

export class ClientConnectRpc extends ClientProxy {
    #config: ClientConnectRpcConfig;
    #clients = new Map<string, Record<string, Function>>();
    #transport: Transport | undefined;
    #connectPromise: Promise<void> | undefined;
    #desc: DescService[];

    constructor(config: ClientConnectRpcConfig) {
        super();
        this.#config = config;
        this.#desc = Array.isArray(config.services) ? config.services : [config.services];
        if (!this.#desc || this.#desc.length === 0) {
            throw new Error("No Connect service definitions provided.");
        }

        this.initializeSerializer({});
        this.initializeDeserializer({});
    }

    override async connect(): Promise<void> {
        if (this.#transport) {
            return;
        }
        if (this.#connectPromise) {
            return this.#connectPromise;
        }

        this.#connectPromise = (async () => {
            this.#transport =
                "customTransport" in this.#config.transport
                    ? this.#config.transport.customTransport
                    : await this.#createNodeTransport(this.#config.transport);
        })();

        try {
            await this.#connectPromise;
        } catch (err) {
            this.#connectPromise = undefined;
            throw err;
        }
    }

    async #createNodeTransport(options: ConnectTransportOptions): Promise<Transport> {
        const { createConnectTransport } = await import("@connectrpc/connect-node");
        return createConnectTransport(options);
    }

    override close() {
        this.#clients.clear();
        this.#transport = undefined;
        this.#connectPromise = undefined;
    }

    override unwrap<T>(): T {
        return this.#clients as T;
    }

    sendWithOptions<TResult = any, TInput = any>(
        pattern: MsPattern,
        data: TInput,
        options?: CallOptions,
    ): Observable<TResult> {
        return defer(async () => this.connect()).pipe(
            mergeMap(
                () =>
                    new Observable<TResult>((observer) => {
                        const callback = this.createObserver(observer);
                        return this.publish({ pattern, data }, callback, options);
                    }),
            ),
        );
    }

    emitWithOptions<TResult = any, TInput = any>(
        pattern: MsPattern,
        data: TInput,
        options?: CallOptions,
    ): Observable<TResult> {
        const source = defer(async () => this.connect()).pipe(
            mergeMap(() => this.dispatchEvent<TResult>({ pattern, data }, options)),
        );
        const connectableSource = connectable(source, {
            connector: () => new Subject(),
            resetOnDisconnect: false,
        });
        connectableSource.connect();
        return connectableSource;
    }

    protected override publish(
        packet: ReadPacket,
        callback: (packet: WritePacket) => void,
        options?: CallOptions,
        eventMode?: boolean,
    ): () => void {
        const { service, method } = this.#resolvePattern(packet.pattern);
        let cancelled = false;
        const controller = new AbortController();
        const abort = () => controller.abort();
        if (options?.signal?.aborted) {
            abort();
        } else {
            options?.signal?.addEventListener("abort", abort, { once: true });
        }
        const callOptions: CallOptions = { ...options, signal: controller.signal };

        void Promise.resolve(this.#getClient(service)[method](packet.data, callOptions))
            .then(async (result: unknown) => {
                if (
                    result &&
                    typeof (result as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function"
                ) {
                    for await (const value of result as AsyncIterable<unknown>) {
                        if (!cancelled) callback({ response: value });
                    }
                } else if (!cancelled) {
                    callback({ response: result });
                }
                if (!cancelled) callback({ isDisposed: true });
            })
            .catch((err) => !cancelled && callback({ err, isDisposed: true }));

        return () => {
            cancelled = true;
            options?.signal?.removeEventListener("abort", abort);
            controller.abort();
        };
    }

    protected override async dispatchEvent<T = undefined>(
        packet: ReadPacket,
        options?: CallOptions,
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            try {
                this.publish(
                    packet,
                    ({ err, isDisposed }) => {
                        if (err) {
                            reject(err);
                        } else if (isDisposed) {
                            resolve(undefined as T);
                        }
                    },
                    options,
                    true,
                );
            } catch (err) {
                reject(err);
            }
        });
    }

    #getClient(serviceName: string): Record<string, Function> {
        let client = this.#clients.get(serviceName);
        if (client) return client;

        const service = this.#desc.find(({ typeName }) => typeName === serviceName);
        if (!this.#transport) {
            throw new Error(`No Connect transport configured`);
        }
        if (!service) {
            throw new Error(`No Connect service configured: ${serviceName}`);
        }

        client = createClient(service, this.#transport) as Record<string, Function>;
        this.#clients.set(serviceName, client);

        return client;
    }

    #resolvePattern(pattern: MsPattern): { service: string; method: string } {
        if (typeof pattern === "object" && pattern && "service" in pattern && "method" in pattern) {
            const { service, method } = pattern as { service: string; method: string };
            return { service, method };
        }
        const [service, ...methodParts] = String(pattern).split(".");
        if (!service || methodParts.length === 0)
            throw new Error(`Invalid Connect pattern: ${String(pattern)}`);
        return { service, method: methodParts.join(".") };
    }
}
