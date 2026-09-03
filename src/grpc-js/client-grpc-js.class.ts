import { ClientProxy, type MsPattern, type ReadPacket, type WritePacket } from "@nestjs/microservices";
import {
    credentials,
    makeClientConstructor,
    type CallOptions,
    type ChannelCredentials,
    type ClientOptions,
    type Metadata,
    type ServiceDefinition,
} from "@grpc/grpc-js";
import type { ServiceClient } from "@grpc/grpc-js/build/src/make-client.js";
import { defer, mergeMap, Observable } from "rxjs";

export interface ClientGrpcJsConfig {
    address: string;
    services: Record<string, ServiceDefinition>;
    credentials?: ChannelCredentials;
    options?: Partial<ClientOptions>;
}

export interface GrpcJsSendOptions {
    metadata?: Metadata;
    callOptions?: CallOptions;
}

export class ClientGrpcJs extends ClientProxy {
    #config: ClientGrpcJsConfig;
    #clients = new Map<string, ServiceClient>();

    constructor(config: ClientGrpcJsConfig) {
        super();
        this.#config = config;

        if (!this.#config.services || Object.keys(this.#config.services).length === 0) {
            throw new Error("No gRPC service definitions provided.");
        }

        this.initializeSerializer({});
        this.initializeDeserializer({});
    }

    async connect(): Promise<void> {}

    close() {
        for (const client of this.#clients.values()) {
            client.close();
        }
        this.#clients.clear();
    }

    unwrap<T>(): T {
        return this.#clients as T;
    }

    sendWithOptions<TResult = any, TInput = any>(
        pattern: MsPattern,
        data: TInput,
        options?: GrpcJsSendOptions,
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
        options?: GrpcJsSendOptions,
    ): () => void {
        const { service, method } = this.#resolvePattern(packet.pattern);
        const client = this.#getClient(service);
        const call = client[method] as Function;
        const methodDefinition = this.#config.services[service]?.[method];
        let cancelled = false;

        try {
            const args: unknown[] = [packet.data];
            if (options?.metadata) args.push(options.metadata);
            if (options?.callOptions) args.push(options.callOptions);
            if (!methodDefinition?.responseStream) {
                args.push((err: unknown, response: unknown) => {
                    if (cancelled) return;
                    callback(err ? { err, isDisposed: true } : { response, isDisposed: true });
                });
            }
            const result = call.call(client, ...args);

            if (result?.on && typeof result.on === "function") {
                result.on("data", (response: unknown) => !cancelled && callback({ response }));
                result.on("error", (err: unknown) => !cancelled && callback({ err, isDisposed: true }));
                result.on("end", () => !cancelled && callback({ isDisposed: true }));
            }
            return () => {
                cancelled = true;
                result?.cancel?.();
            };
        } catch (err) {
            callback({ err, isDisposed: true });
            return () => {};
        }
    }

    async dispatchEvent<T = any>(packet: ReadPacket): Promise<T> {
        const { service, method } = this.#resolvePattern(packet.pattern);
        const client = this.#getClient(service);
        await new Promise<void>((resolve, reject) => {
            client[method](packet.data, (err: unknown) => (err ? reject(err) : resolve()));
        });
        return undefined as T;
    }

    #getClient(service: string): ServiceClient {
        let client = this.#clients.get(service);
        if (client) return client;

        const serviceDefinition = this.#config.services[service];
        if (!serviceDefinition) throw new Error(`No gRPC service configured: ${service}`);
        const Constructor = makeClientConstructor(serviceDefinition, service);
        client = new Constructor(
            this.#config.address,
            this.#config.credentials ?? credentials.createInsecure(),
            this.#config.options,
        );
        this.#clients.set(service, client);
        return client;
    }

    #resolvePattern(pattern: MsPattern): { service: string; method: string } {
        if (typeof pattern === "object" && pattern && "service" in pattern && "method" in pattern) {
            const { service, method } = pattern as { service: string; method: string };
            return { service, method };
        }
        const [service, ...methodParts] = String(pattern).split(".");
        if (!service || methodParts.length === 0) throw new Error(`Invalid gRPC pattern: ${String(pattern)}`);
        return { service, method: methodParts.join(".") };
    }
}
