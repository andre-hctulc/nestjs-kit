import { ClientProxy, type MsPattern, type ReadPacket, type WritePacket } from "@nestjs/microservices";
import {
    connect,
    type Channel,
    type ChannelModel,
    type ConsumeMessage,
    type Options,
    type SocketOptions,
} from "amqplib";
import { randomUUID } from "node:crypto";
import { connectable, defer, mergeMap, Observable, Subject } from "rxjs";
import type {
    RabbitMqErrorResponse,
    RabbitMqHandlerOptions,
    RabbitMqResponse,
    RabbitMqStreamResponse,
} from "./rabbitmq.server.js";
import { normalizeQueueSuffix, normalizeRabbitPattern } from "./rabbit-system.util.js";

const DIRECT_REPLY_TO = "amq.rabbitmq.reply-to";
const DEADLINE_HEADER = "x-rabbitmq-deadline";

export interface RabbitMqClientSetup {
    publishOptions?: Options.Publish;
    consumeOptions?: Options.Consume;
}

export interface ClientRabbitMqConfig {
    url: string;
    exchange?: string;
    options?: SocketOptions;
    setup?: RabbitMqClientSetup;
    replyQueue?: string;
    /**
     * Default handler options.
     * Merged with handler level options.
     */
    handlerOptions?: Omit<RabbitMqHandlerOptions, "setup">;
}

export interface RabbitMqSendOptions extends Options.Publish {
    timeout?: number;
}

type ReplyCallback = (packet: WritePacket) => void;

export class ClientRabbitMq extends ClientProxy {
    #config: ClientRabbitMqConfig;
    #channelModel: ChannelModel | undefined;
    #channel: Channel | undefined;
    #connectPromise: Promise<Channel> | undefined;
    #pendingReplies = new Map<string, ReplyCallback>();

    constructor(config: ClientRabbitMqConfig) {
        super();
        this.#config = config;
        this.initializeSerializer({});
        this.initializeDeserializer({});
    }

    async connect(): Promise<Channel> {
        if (this.#channel) {
            return this.#channel;
        }
        if (this.#connectPromise) {
            return this.#connectPromise;
        }

        this.#connectPromise = (async () => {
            const address = this.#config.url ?? "amqp://localhost";
            this.#channelModel = await connect(address, this.#config.options);
            this.#channelModel.on("error", (err) => this.#handleConnectionError(err));
            this.#channelModel.on("close", () => this.#handleConnectionClose());

            this.#channel = await this.#channelModel.createChannel();
            this.#channel.on("error", (err) => this.#handleConnectionError(err));

            await this.#channel.consume(
                this.#config.replyQueue ?? DIRECT_REPLY_TO,
                (message) => this.#handleReply(message),
                {
                    ...this.#config.setup?.consumeOptions,
                    noAck: true,
                },
            );
            return this.#channel;
        })();

        try {
            return await this.#connectPromise;
        } catch (err) {
            this.#connectPromise = undefined;
            await this.#channelModel?.close();
            this.#channel = undefined;
            this.#channelModel = undefined;
            throw err;
        }
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
        this.#connectPromise = undefined;
    }

    unwrap<T>(): T {
        return this.#channelModel as T;
    }

    #handleConnectionError(err: unknown) {
        this.#rejectPendingReplies(err instanceof Error ? err : new Error(String(err)));
        this.#resetConnectionState();
    }

    #handleConnectionClose() {
        this.#rejectPendingReplies(new Error("RabbitMQ connection closed"));
        this.#resetConnectionState();
    }

    #rejectPendingReplies(err: Error) {
        for (const callback of this.#pendingReplies.values()) {
            callback({ err, isDisposed: true });
        }
        this.#pendingReplies.clear();
    }

    #resetConnectionState() {
        this.#channel = undefined;
        this.#channelModel = undefined;
        this.#connectPromise = undefined;
    }

    sendWithOptions<TResult = any, TInput = any>(
        pattern: MsPattern,
        data: TInput,
        options?: RabbitMqSendOptions,
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
        options?: RabbitMqSendOptions,
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
        callback: ReplyCallback,
        options?: RabbitMqSendOptions,
        eventMode?: boolean,
    ): () => void {
        const route = normalizeRabbitPattern(packet.pattern);

        const exchange = route.exchange ?? this.#config.exchange ?? "default";
        const routingKey = route.routingKey ?? "";

        const normalizedQueueSuffix = normalizeQueueSuffix(route.queueSuffix);

        /**
         * If this is given, sendToQuery is used, publish otherwise.
         * If a queueSuffix is provided, it will be appended to the exchange and routing key to form the queue.
         */
        const queue =
            route.queue ??
            (normalizedQueueSuffix ? `${exchange}.${routingKey}${normalizedQueueSuffix}` : null);

        const reqId = randomUUID();
        let timer: NodeJS.Timeout | undefined;

        void this.connect()
            .then((channel) => {
                const serializedPacket = this.serializer.serialize({ ...packet, id: reqId });
                this.#pendingReplies.set(reqId, callback);

                const timeout = options?.timeout ?? this.#config.handlerOptions?.timeout;

                if (timeout !== undefined) {
                    timer = setTimeout(() => {
                        if (this.#pendingReplies.delete(reqId)) {
                            callback({ err: new Error("RabbitMQ request timed out"), isDisposed: true });
                        }
                    }, timeout);
                }
                const deadline = timeout === undefined ? undefined : Date.now() + timeout;

                const publishOptions: Options.Publish = {
                    ...this.#config.setup?.publishOptions,
                    ...options,
                    replyTo: eventMode ? undefined : (this.#config.replyQueue ?? DIRECT_REPLY_TO),
                    correlationId: eventMode ? undefined : reqId,
                    contentType: "application/json",
                    headers: {
                        ...this.#config.setup?.publishOptions?.headers,
                        ...options?.headers,
                        ...(deadline === undefined ? {} : { [DEADLINE_HEADER]: deadline }),
                    },
                };
                const payload = Buffer.from(JSON.stringify(serializedPacket));

                // send to queue directly if a queue is specified
                if (queue) {
                    channel.sendToQueue(queue, payload, publishOptions);
                }
                // Send to exchange using routing key
                else {
                    channel.publish(exchange, routingKey, payload, publishOptions);
                }

                if (eventMode) {
                    callback({ isDisposed: true });
                }
            })
            .catch((err) => callback({ err, isDisposed: true }));

        return () => {
            if (timer) clearTimeout(timer);
            this.#pendingReplies.delete(reqId);
        };
    }

    protected override async dispatchEvent<T = any>(
        packet: ReadPacket,
        options?: RabbitMqSendOptions,
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
                if (payload.streamEnd) {
                    this.#pendingReplies.delete(message.properties.correlationId);
                    callback({ isDisposed: true });
                    return;
                }
                callback({ response: payload.chunk });
                return;
            }
            if (this.#isErrorResponse(payload)) {
                this.#pendingReplies.delete(message.properties.correlationId);
                callback({ err: this.#toError(payload), isDisposed: true });
                return;
            }
            if (this.#isResponse(payload)) {
                this.#pendingReplies.delete(message.properties.correlationId);
                callback({ response: payload.result, isDisposed: true });
                return;
            }

            this.#pendingReplies.delete(message.properties.correlationId);
            callback({ err: new Error("Invalid RabbitMQ response"), isDisposed: true });
        } catch (err) {
            this.#pendingReplies.delete(message.properties.correlationId);
            callback({ err, isDisposed: true });
        }
    }

    #isStreamResponse(value: unknown): value is RabbitMqStreamResponse {
        return !!value && typeof value === "object" && "chunk" in value;
    }

    #isErrorResponse(value: unknown): value is RabbitMqErrorResponse {
        return !!value && typeof value === "object" && "error" in value;
    }

    #isResponse(value: unknown): value is RabbitMqResponse {
        return !!value && typeof value === "object" && "result" in value;
    }

    #toError({ error }: RabbitMqErrorResponse): Error {
        return Object.assign(new Error(error.message), error);
    }
}
