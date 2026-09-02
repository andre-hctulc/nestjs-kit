import type { CustomTransportStrategy, MsPattern } from "@nestjs/microservices";
import { Server, Transport } from "@nestjs/microservices";
import { Logger } from "@nestjs/common";
import { isObservable, type Observable } from "rxjs";
import {
    connect,
    type Channel,
    type ChannelModel,
    type ConfirmChannel,
    type ConsumeMessage,
    type Options,
    type SocketOptions,
} from "amqplib";
import {
    iterateWithSignal,
    isAsyncGenerator,
    isGenerator,
    raceWithSignal,
    resolveFinalTimeout,
} from "../common/util/system/system.util.js";
import { toErrorShape } from "../common/index.js";

export interface RabbitMqHandlerOptions {
    exchange?: Options.AssertExchange;
    queue?: Options.AssertQueue;
    dlq?: Options.AssertQueue;
    replyPublish?: Options.Publish;
    dlqPublish?: Options.Publish;
}

export interface RabbitMqConnection {
    address: string;
    options?: SocketOptions;
}

export interface RabbitMqServerConfig {
    connections?: Record<string, RabbitMqConnection>;
    timeout?: number;
    /**
     * Enable dead letter queue (DLQ) support for all queue
     * @default true
     */
    dlq?: boolean;
    /**
     * Default handler options.
     * Merged with handler specified options.
     */
    handlerOptions?: RabbitMqHandlerOptions;
}

type MessageHandler = (...args: any[]) => any;

export interface RabbitMqMethodPattern {
    exchange?: string;
    socket?: string;
    routingKey: string;
    queue?: string;
    dlq?: string | false;
    options?: RabbitMqHandlerOptions & { timeout?: number };
}

export interface RabbitMqStreamResponse {
    __rabbit_stream_chunk__: unknown;
    __rabbit_stream_end__?: boolean;
}

/** 2min in milliseconds */
const DEFAULT_TIMEOUT = 120_000;

/** 24h in milliseconds */
const MAX_TIMEOUT = 86_400_000;

export class RabbitMqServer
    extends Server<Record<string, (...args: any[]) => any>, string>
    implements CustomTransportStrategy
{
    #logger = new Logger(RabbitMqServer.name);

    override readonly transportId = Transport.RMQ;

    #config: RabbitMqServerConfig;
    #connections: Record<string, RabbitMqConnection>;
    #channelModels = new Map<string, ChannelModel>();
    #closeInitiated = false;

    constructor(config: RabbitMqServerConfig = {}) {
        super();
        this.#config = config;
        this.#connections = config.connections ?? { default: { address: "amqp://localhost" } };
    }

    override unwrap<T>(): T {
        return this.#channelModels.get("default") as T;
    }

    protected override normalizePattern(pattern: MsPattern): string {
        let obj: Record<string, any> = {};

        if (typeof pattern === "string") {
            let exchange: string | undefined;
            let routingKey: string | undefined;

            const parts = pattern.split(".");
            if (parts.length === 1) {
                routingKey = parts[0];
            } else if (parts.length >= 2) {
                exchange = parts[0];
                routingKey = parts.slice(1).join(".");
            }
            obj = { exchange, routingKey, socket: "default" };
        } else if (typeof pattern === "object" && pattern !== null && "routingKey" in pattern) {
            obj = pattern;
        } else {
            return JSON.stringify({ routingKey: String(pattern) } satisfies RabbitMqMethodPattern);
        }

        return JSON.stringify({
            exchange: obj.exchange,
            routingKey: obj.routingKey,
            queue: obj.queue,
            dlq: obj.dlq,
            socket: obj.socket || "default",
            options: obj.options,
        } satisfies RabbitMqMethodPattern);
    }

    async listen(callback: () => void) {
        await Promise.all(
            Object.entries(this.#connections).map(([name, socket]) => this.#setupChannelModel(name, socket)),
        );

        const handlers = this.getHandlers();
        if (handlers.size === 0) {
            this.#logger.warn("No message handlers registered");
        } else {
            await Promise.all(
                Array.from(handlers, ([pattern, handler]) => this.#registerHandler(pattern, handler)),
            );
        }

        callback();
    }

    async close() {
        this.#closeInitiated = true;
        await Promise.all(Array.from(this.#channelModels.values(), (channelModel) => channelModel.close()));
        this.#channelModels.clear();
    }

    async #setupChannelModel(name: string, socket: RabbitMqConnection) {
        const channelModel = await connect(socket.address, socket.options);
        this.#channelModels.set(name, channelModel);

        channelModel.on("close", () => {
            if (!this.#closeInitiated) {
                this.#logger.error(`RabbitMQ connection closed unexpectedly: ${name}`);
            }
            this.#channelModels.delete(name);
        });

        channelModel.on("error", (err) => {
            this.#logger.error(`RabbitMQ connection error: ${name}`, err);
        });
    }

    async #registerHandler(pattern: string, handler: MessageHandler) {
        const route = this.#parsePattern(pattern);

        const options = this.#resolveHandlerOptions(route.options);

        const exchange = route.exchange ?? "default";
        const socketName = route.socket ?? "default";
        const routingKey = route.routingKey ?? "";
        const queue = route.queue ?? `${exchange}.${routingKey}`;

        const channelModel = this.#channelModels.get(socketName);
        if (!channelModel) {
            throw new Error(`No RabbitMQ address configured for exchange: ${exchange}`);
        }

        const channel = await channelModel.createChannel();
        await channel.assertExchange(exchange, "topic", { durable: true, ...options.exchange });
        await channel.assertQueue(queue, { durable: true, ...options.queue });
        await channel.bindQueue(queue, exchange, routingKey);
        const dlq = this.#resolveDlq(route, queue);
        const dlqChannel = dlq ? await channelModel.createConfirmChannel() : undefined;
        if (dlq) {
            await channel.assertQueue(dlq, { durable: true, ...options.dlq });
            await channel.bindQueue(dlq, exchange, dlq);
        }
        await channel.consume(
            queue,
            (message) => this.#handleMessage(channel, dlqChannel, handler, message, exchange, dlq, options),
            {
                noAck: false,
            },
        );

        this.#logger.log(`Registered RabbitMQ handler: ${exchange}.${routingKey}`);
    }

    async #handleMessage(
        channel: Channel,
        dlqChannel: ConfirmChannel | undefined,
        handler: MessageHandler,
        message: ConsumeMessage | null,
        exchange: string,
        dlq: string | undefined,
        handlerOptions: RabbitMqHandlerOptions & { timeout?: number },
    ) {
        if (!message) {
            return;
        }

        const handlerLabel = `${exchange}.${message.fields.routingKey}`;

        const timeout = resolveFinalTimeout(
            undefined,
            handlerOptions.timeout ?? this.#config.timeout ?? DEFAULT_TIMEOUT,
            MAX_TIMEOUT,
        );

        try {
            const content = JSON.parse(message.content.toString("utf8"));
            const signal = AbortSignal.timeout(timeout);
            const resultPromise = Promise.resolve(handler(content.data, message));
            const result = await raceWithSignal(resultPromise, signal);

            if (isAsyncGenerator(result) || isGenerator(result)) {
                for await (const value of iterateWithSignal(result, signal)) {
                    this.#sendDirectReply(
                        channel,
                        message,
                        { __rabbit_stream_chunk__: value },
                        handlerOptions,
                    );
                }
                this.#sendDirectReply(
                    channel,
                    message,
                    { __rabbit_stream_chunk__: null, __rabbit_stream_end__: true },
                    handlerOptions,
                );
            } else if (isObservable(result)) {
                await this.#awaitObservable(result, signal, (value) =>
                    this.#sendDirectReply(
                        channel,
                        message,
                        { __rabbit_stream_chunk__: value },
                        handlerOptions,
                    ),
                );
                this.#sendDirectReply(
                    channel,
                    message,
                    { __rabbit_stream_chunk__: null, __rabbit_stream_end__: true },
                    handlerOptions,
                );
            } else if (result !== undefined) {
                this.#sendDirectReply(channel, message, result, handlerOptions);
            }
            channel.ack(message);
        } catch (err) {
            this.#logger.error(`Error at ${handlerLabel}`, err);
            if (dlq && dlqChannel) {
                try {
                    const publishOptions = handlerOptions.dlqPublish;
                    dlqChannel.publish(exchange, dlq, message.content, {
                        persistent: true,
                        contentType: message.properties.contentType,
                        correlationId: message.properties.correlationId,
                        ...publishOptions,
                        headers: {
                            ...message.properties.headers,
                            ...publishOptions?.headers,
                            error: JSON.stringify(toErrorShape(err)),
                        },
                    });
                    await dlqChannel.waitForConfirms();
                } catch (publishError) {
                    this.#logger.error(`Failed to publish to DLQ at ${handlerLabel}`, publishError);
                    channel.nack(message, false, true);
                    return;
                }
                channel.ack(message);
            } else {
                channel.nack(message, false, false);
            }
        }
    }

    #resolveDlq(route: RabbitMqMethodPattern, queue: string): string | undefined {
        if (this.#config.dlq === false || route.dlq === false) {
            return undefined;
        }

        return route.dlq ?? `${queue}.dlq`;
    }

    #resolveHandlerOptions(
        options: RabbitMqMethodPattern["options"],
    ): RabbitMqHandlerOptions & { timeout?: number } {
        const defaults = this.#config.handlerOptions;
        return {
            ...defaults,
            ...options,
            exchange: { ...defaults?.exchange, ...options?.exchange },
            queue: { ...defaults?.queue, ...options?.queue },
            dlq: { ...defaults?.dlq, ...options?.dlq },
            replyPublish: { ...defaults?.replyPublish, ...options?.replyPublish },
            dlqPublish: { ...defaults?.dlqPublish, ...options?.dlqPublish },
        };
    }

    #sendDirectReply(
        channel: Channel,
        message: ConsumeMessage,
        result: unknown,
        handlerOptions: RabbitMqHandlerOptions,
    ) {
        const { replyTo, correlationId } = message.properties;
        if (!replyTo) {
            return;
        }

        channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(result)), {
            ...handlerOptions.replyPublish,
            contentType: "application/json",
            correlationId,
        });
    }

    async #awaitObservable(
        observable: Observable<unknown>,
        signal: AbortSignal | undefined,
        onValue: (value: unknown) => void,
    ) {
        signal?.throwIfAborted();

        return new Promise<void>((resolve, reject) => {
            let settled = false;
            const cleanup = () => signal?.removeEventListener("abort", onAbort);
            const complete = () => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve();
            };
            const fail = (error: unknown) => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(error);
            };
            const subscription = observable.subscribe({ next: onValue, complete, error: fail });
            const onAbort = () => {
                subscription.unsubscribe();
                fail(signal?.reason ?? new Error("RabbitMQ message handler timed out"));
            };

            signal?.addEventListener("abort", onAbort, { once: true });
            if (signal?.aborted) onAbort();
        });
    }

    #parsePattern(pattern: string): RabbitMqMethodPattern {
        try {
            return JSON.parse(pattern) as RabbitMqMethodPattern;
        } catch (err) {
            throw new Error(`Unsupported RabbitMQ message pattern: ${pattern}`, { cause: err });
        }
    }

    override on(event: string, listener: (...args: any[]) => any): void {
        this.#channelModels.forEach((channelModel) => {
            channelModel.on(event, (...args) => listener(channelModel, ...args));
        });
    }

    off(event: string, listener: (...args: any[]) => any): this {
        this.#channelModels.forEach((channelModel) => {
            channelModel.off(event, listener);
        });
        return this;
    }
}
