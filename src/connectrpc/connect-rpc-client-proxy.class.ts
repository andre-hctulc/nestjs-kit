import { ClientProxy, type MsPattern, type ReadPacket, type WritePacket } from "@nestjs/microservices";
import { createClient, type CallOptions, type Transport } from "@connectrpc/connect";
import type { DescService } from "@bufbuild/protobuf";
import type { ConnectTransportOptions } from "@connectrpc/connect-node";
import { defer, mergeMap, Observable } from "rxjs";

export interface ConnectRpcClientProxyConfig {
    transport: { customTransport: Transport } | ConnectTransportOptions;
    services: DescService[];
}

export class ConnectRpcClientProxy extends ClientProxy {
    #config: ConnectRpcClientProxyConfig;
    #clients = new Map<string, Record<string, Function>>();
    #transport: Transport | undefined;
    #connectPromise: Promise<void> | undefined;

    constructor(config: ConnectRpcClientProxyConfig) {
        super();
        this.#config = config;

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
                    : await this.#creteNodeTransport(this.#config.transport);
        })();

        try {
            await this.#connectPromise;
        } catch (err) {
            this.#connectPromise = undefined;
            throw err;
        }
    }

    async #creteNodeTransport(options: ConnectTransportOptions): Promise<Transport> {
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

    protected override publish(
        packet: ReadPacket,
        callback: (packet: WritePacket) => void,
        options?: CallOptions,
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

    async dispatchEvent<T = any>(packet: ReadPacket): Promise<T> {
        const { service, method } = this.#resolvePattern(packet.pattern);
        await this.#getClient(service)[method](packet.data);
        return undefined as T;
    }

    #getClient(serviceName: string): Record<string, Function> {
        let client = this.#clients.get(serviceName);
        if (client) return client;

        const service = this.#config.services.find(({ typeName }) => typeName === serviceName);
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
