import { ClientProxy, type MsPattern, type ReadPacket, type WritePacket } from "@nestjs/microservices";
import { connect, type Channel, type ChannelModel, type ConsumeMessage, type Options } from "amqplib";
import { randomUUID } from "node:crypto";
import type { RabbitMqConnection, RabbitMqMethodPattern, RabbitMqStreamResponse } from "./rabbitmq.server.js";

const DIRECT_REPLY_TO = "amq.rabbitmq.reply-to";

export interface RabbitMqClientProxyConfig extends Partial<RabbitMqConnection> {
    timeout?: number;
    publish?: Options.Publish;
    replyQueue?: string;
}

type ReplyCallback = (packet: WritePacket) => void;

export class RabbitMqClientProxy extends ClientProxy {
    #config: RabbitMqClientProxyConfig;
    #channelModel: ChannelModel | undefined;
    #channel: Channel | undefined;
    #pendingReplies = new Map<string, ReplyCallback>();

    constructor(config: RabbitMqClientProxyConfig) {
        super();
        this.#config = config;
        this.initializeSerializer({});
        this.initializeDeserializer({});
    }

    async connect(): Promise<Channel> {
        if (this.#channel) {
            return this.#channel;
        }

        const address = this.#config.url ?? "amqp://localhost";
        const options = this.#config.options;
        this.#channelModel = await connect(address, options);
        this.#channel = await this.#channelModel.createChannel();
        await this.#channel.consume(
            this.#config.replyQueue ?? DIRECT_REPLY_TO,
            (message) => this.#handleReply(message),
            { noAck: true },
        );
        return this.#channel;
    }

    async close() {
        const error = new Error("RabbitMQ client closed");
        for (const callback of this.#pendingReplies.values()) {
            callback({ err: error, isDisposed: true });
        }
        this.#pendingReplies.clear();
        await this.#channelModel?.close();
        this.#channel = undefined;
        this.#channelModel = undefined;
    }

    unwrap<T>(): T {
        return this.#channelModel as T;
    }

    protected override publish(packet: ReadPacket, callback: ReplyCallback): () => void {
        const id = "id" in packet && typeof packet.id === "string" ? packet.id : randomUUID();
        const route = this.#resolveRoute(packet.pattern);
        let timer: ReturnType<typeof setTimeout> | undefined;

        void this.connect()
            .then((channel) => {
                const serializedPacket = this.serializer.serialize({ ...packet, id });
                const { options, ...payload } = serializedPacket as Record<string, unknown> & {
                    options?: Options.Publish;
                };
                this.#pendingReplies.set(id, callback);
                if (this.#config.timeout !== undefined) {
                    timer = setTimeout(() => {
                        if (this.#pendingReplies.delete(id)) {
                            callback({ err: new Error("RabbitMQ request timed out"), isDisposed: true });
                        }
                    }, this.#config.timeout);
                }
                channel.publish(route.exchange, route.routingKey, Buffer.from(JSON.stringify(payload)), {
                    ...this.#config.publish,
                    ...options,
                    replyTo: this.#config.replyQueue ?? DIRECT_REPLY_TO,
                    correlationId: id,
                    contentType: "application/json",
                });
            })
            .catch((err) => callback({ err, isDisposed: true }));

        return () => {
            if (timer) clearTimeout(timer);
            this.#pendingReplies.delete(id);
        };
    }

    async dispatchEvent<T = any>(packet: ReadPacket): Promise<T> {
        const channel = await this.connect();
        const route = this.#resolveRoute(packet.pattern);
        const serializedPacket = this.serializer.serialize(packet);
        const { options, ...payload } = serializedPacket as Record<string, unknown> & {
            options?: Options.Publish;
        };
        channel.publish(route.exchange, route.routingKey, Buffer.from(JSON.stringify(payload)), {
            ...this.#config.publish,
            ...options,
            contentType: "application/json",
        });
        return undefined as T;
    }

    #handleReply(message: ConsumeMessage | null) {
        if (!message?.properties.correlationId) {
            return;
        }

        const callback = this.#pendingReplies.get(message.properties.correlationId);
        if (!callback) {
            return;
        }

        try {
            const payload = JSON.parse(message.content.toString("utf8")) as unknown;
            if (this.#isStreamResponse(payload)) {
                if (payload.__rabbit_stream_end__) {
                    this.#pendingReplies.delete(message.properties.correlationId);
                    callback({ isDisposed: true });
                    return;
                }
                callback({ response: payload.__rabbit_stream_chunk__ });
                return;
            }

            this.#pendingReplies.delete(message.properties.correlationId);
            callback({ response: payload, isDisposed: true });
        } catch (err) {
            this.#pendingReplies.delete(message.properties.correlationId);
            callback({ err, isDisposed: true });
        }
    }

    #resolveRoute(pattern: MsPattern): Required<Pick<RabbitMqMethodPattern, "exchange" | "routingKey">> {
        if (typeof pattern === "string") {
            const [exchange, ...routingKeyParts] = pattern.split(".");
            return routingKeyParts.length > 0
                ? { exchange, routingKey: routingKeyParts.join(".") }
                : { exchange: "default", routingKey: exchange };
        }

        if (typeof pattern === "object" && pattern !== null && "routingKey" in pattern) {
            const route = pattern as unknown as RabbitMqMethodPattern;
            return { exchange: route.exchange ?? "default", routingKey: route.routingKey };
        }

        return { exchange: "default", routingKey: String(pattern) };
    }

    #isStreamResponse(value: unknown): value is RabbitMqStreamResponse {
        return !!value && typeof value === "object" && "__rabbit_stream_chunk__" in value;
    }
}
