import { ClientProxy, type MsPattern, type ReadPacket, type WritePacket } from "@nestjs/microservices";
import {
    credentials,
    makeClientConstructor,
    type ChannelCredentials,
    type ClientOptions,
    type ServiceDefinition,
} from "@grpc/grpc-js";
import type { ServiceClient } from "@grpc/grpc-js/build/src/make-client.js";

export interface GrpcJsClientProxyConfig {
    address: string;
    services: Record<string, ServiceDefinition>;
    credentials?: ChannelCredentials;
    options?: Partial<ClientOptions>;
}

export class GrpcJsClientProxy extends ClientProxy {
    #config: GrpcJsClientProxyConfig;
    #clients = new Map<string, ServiceClient>();

    constructor(config: GrpcJsClientProxyConfig) {
        super();
        this.#config = config;
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

    protected override publish(packet: ReadPacket, callback: (packet: WritePacket) => void): () => void {
        const { service, method } = this.#resolvePattern(packet.pattern);
        const client = this.#getClient(service);
        const call = client[method] as Function;
        let cancelled = false;

        try {
            const result = call.call(client, packet.data, (err: unknown, response: unknown) => {
                if (cancelled) return;
                callback(err ? { err, isDisposed: true } : { response, isDisposed: true });
            });

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
