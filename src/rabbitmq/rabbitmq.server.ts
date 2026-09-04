import type { CustomTransportStrategy, MsPattern } from "@nestjs/microservices";
import { Server, Transport } from "@nestjs/microservices";
import { Logger } from "@nestjs/common";
import { isObservable, type Observable } from "rxjs";
import {
    connect,
    type Channel,
    type ChannelModel,
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
import { toErrorShape, type ErrorShape } from "../common/errors/index.js";
import { normalizeAndSerializeRabbitPattern } from "./rabbit-system.util.js";

export interface RabbitMqDlOptions {
    /**
     * The default dead letter exchange to use for this connection.
     * Defaults to the exchange name if not specified.
     */
    dlx?: string;
    /** Fixed dlq */
    dlq?: string;
    dlxOptions?: Options.AssertExchange;
    dlqOptions?: Options.AssertQueue;
}

export interface RabbitMqHandlerSetupOptions {
    exchangeOptions?: Options.AssertExchange;
    queueOptions?: Options.AssertQueue;
    publishOptions?: Options.Publish;
    dl?: RabbitMqDlOptions | false;
}

export interface RabbitMqHandlerOptions {
    // TODO implement @RabbitSetup method decorator instead?
    /** Handler level setup options */
    setup?: RabbitMqHandlerSetupOptions;
    timeout?: number;
}

export interface RabbitMqConnection {
    url: string;
    options?: SocketOptions;
    /** The default exchange to use for this connection. */
    exchange?: string;
    /** Connection level setup options. */
    setup?: RabbitMqHandlerSetupOptions;
}

export interface RabbitMqServerConfig {
    connection: RabbitMqConnection | Record<string, RabbitMqConnection>;
    /** Shared setup options */
    setup?: RabbitMqHandlerSetupOptions;
    /**
     * Default handler options.
     * Merged with handler level options.
     */
    handlerOptions?: Omit<RabbitMqHandlerOptions, "setup">;
}

type MessageHandler = ((...args: any[]) => any) & {
    isEventHandler?: boolean;
    next?: MessageHandler;
};

export interface RabbitMqMethodPattern {
    exchange?: string;
    connection?: string;
    routingKey: string;
    queue?: string;
    options?: RabbitMqHandlerOptions;
}

export type RabbitMqEventPattern = RabbitMqMethodPattern;

export interface RabbitMqStreamResponse {
    chunk: unknown;
    streamEnd?: boolean;
}

export interface RabbitMqErrorResponse {
    error: ErrorShape;
}

export interface RabbitMqResponse {
    result: unknown;
}

/** 2min in milliseconds */
const DEFAULT_TIMEOUT = 120_000;

/** 24h in milliseconds */
const MAX_TIMEOUT = 86_400_000;
const DEADLINE_HEADER = "x-rabbitmq-deadline";

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

    constructor(config: RabbitMqServerConfig) {
        super();
        this.#config = config;

        if (typeof config.connection.url === "string") {
            this.#connections = { default: config.connection as RabbitMqConnection };
        } else {
            this.#connections = config.connection as Record<string, RabbitMqConnection>;
        }
    }

    override unwrap<T>(): T {
        return this.#channelModels.get("default") as T;
    }

    protected override normalizePattern(pattern: MsPattern): string {
        return normalizeAndSerializeRabbitPattern(pattern);
    }

    #listening = false;
    async listen(callback: () => void) {
        if (this.#listening) {
            throw new Error("Listen already attempted");
        }
        this.#listening = true;

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
        const channelModel = await connect(socket.url, socket.options);
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

    #getDefaultConnectionName(): string {
        const connectionNames = Object.keys(this.#connections);
        if (connectionNames.length === 0) {
            return "default";
        }
        return connectionNames[0];
    }

    async #registerHandler(pattern: string, handler: MessageHandler) {
        const route = this.#parsePattern(pattern);

        const options = this.#resolveHandlerOptions(route.options);

        const connectionName = route.connection ?? this.#getDefaultConnectionName();
        const routingKey = route.routingKey ?? "";

        const channelModel = this.#channelModels.get(connectionName);
        const connection = this.#connections[connectionName];
        if (!channelModel) {
            throw new Error(`No RabbitMQ address configured for connection: ${connectionName}`);
        }
        if (!connection) {
            throw new Error(`No RabbitMQ connection configured for connection: ${connectionName}`);
        }

        const exchange = route.exchange ?? connection.exchange ?? "default";
        const queue = route.queue ?? `${exchange}.${routingKey}`;
        const setup = this.#resolveSetupOptions(connection, options.setup);
        const dl = setup.dl === false ? undefined : setup.dl;
        const dlq = dl ? (dl.dlq ?? `${queue}.dlq`) : undefined;
        const dlx = dl ? (dl.dlx ?? exchange) : undefined;

        const channel = await channelModel.createChannel();
        await channel.assertExchange(exchange, "topic", { durable: true, ...setup.exchangeOptions });
        if (dlx) {
            await channel.assertExchange(dlx, "topic", { durable: true, ...dl?.dlxOptions });
        }
        await channel.assertQueue(queue, {
            durable: true,
            ...setup.queueOptions,
            arguments: {
                ...setup.queueOptions?.arguments,
                ...(dlx
                    ? {
                          "x-dead-letter-exchange": dlx,
                          "x-dead-letter-routing-key": dlq,
                      }
                    : {}),
            },
        });
        await channel.bindQueue(queue, exchange, routingKey);
        if (dlq) {
            await channel.assertQueue(dlq, { durable: true, ...dl?.dlqOptions });
            await channel.bindQueue(dlq, dlx ?? exchange, dlq);
        }
        await channel.consume(
            queue,
            (message) => this.#handleMessage(channel, handler, message, exchange, dlx, setup, options),
            {
                noAck: false,
            },
        );

        this.#logger.log(`Registered RabbitMQ handler: ${exchange}.${routingKey}`);
    }

    async #handleMessage(
        channel: Channel,
        handler: MessageHandler,
        message: ConsumeMessage | null,
        exchange: string,
        dlx: string | undefined,
        setup: RabbitMqHandlerSetupOptions,
        handlerOptions: RabbitMqHandlerOptions & { timeout?: number },
    ) {
        if (!message) {
            return;
        }

        const handlerLabel = `${exchange}.${message.fields.routingKey}`;

        const timeout = resolveFinalTimeout(
            this.#getDeadline(message.properties.headers?.[DEADLINE_HEADER]),
            handlerOptions.timeout ?? DEFAULT_TIMEOUT,
            MAX_TIMEOUT,
        );

        try {
            const content = JSON.parse(message.content.toString("utf8"));
            const signal = AbortSignal.timeout(timeout);

            // No id: Event call
            if (!content || typeof content !== "object" || !("id" in content)) {
                await this.#handleEventHandlers(handler, content?.data, message, signal);
                channel.ack(message);
                return;
            }

            if (handler.isEventHandler) {
                throw new Error(`RabbitMQ RPC request targets an EventPattern handler: ${handlerLabel}`);
            }

            const resultPromise = Promise.resolve(handler(content.data, message));
            const result = await raceWithSignal(resultPromise, signal);

            if (isAsyncGenerator(result) || isGenerator(result)) {
                for await (const value of iterateWithSignal(result, signal)) {
                    this.#sendDirectReply(
                        channel,
                        message,
                        { chunk: value } satisfies RabbitMqStreamResponse,
                        setup,
                    );
                }
                this.#sendDirectReply(
                    channel,
                    message,
                    {
                        chunk: null,
                        streamEnd: true,
                    } satisfies RabbitMqStreamResponse,
                    setup,
                );
            } else if (isObservable(result)) {
                await this.#awaitObservable(result, signal, (value) =>
                    this.#sendDirectReply(
                        channel,
                        message,
                        { chunk: value } satisfies RabbitMqStreamResponse,
                        setup,
                    ),
                );
                this.#sendDirectReply(
                    channel,
                    message,
                    {
                        chunk: null,
                        streamEnd: true,
                    } satisfies RabbitMqStreamResponse,
                    setup,
                );
            } else {
                this.#sendDirectReply(channel, message, { result } satisfies RabbitMqResponse, setup);
            }
            channel.ack(message);
        } catch (err) {
            this.#logger.error(`Error at ${handlerLabel}`, err);

            // No-op for event handlers, since they don't add replyTo or correlationId properties to the message.
            this.#sendDirectReply(
                channel,
                message,
                { error: toErrorShape(err) } satisfies RabbitMqErrorResponse,
                setup,
            );

            if (dlx) {
                channel.nack(message, false, false);
                return;
            }
            channel.nack(message, false, false);
        }
    }

    async #handleEventHandlers(
        handler: MessageHandler,
        data: unknown,
        message: ConsumeMessage,
        signal: AbortSignal,
    ): Promise<void> {
        let eventHandler: MessageHandler | undefined = handler;
        let found = false;

        while (eventHandler) {
            if (eventHandler.isEventHandler) {
                found = true;
                const result = await raceWithSignal(Promise.resolve(eventHandler(data, message)), signal);

                if (isObservable(result)) {
                    await this.#awaitObservable(result, signal, () => {});
                } else if (isAsyncGenerator(result) || isGenerator(result)) {
                    for await (const _ of iterateWithSignal(result, signal)) {
                        // Event streams are consumed for completion only.
                    }
                }
            }
            eventHandler = eventHandler.next;
        }

        if (!found) {
            throw new Error(`No RabbitMQ event handler registered for ${message.fields.routingKey}`);
        }
    }

    #resolveSetupOptions(
        connection: RabbitMqConnection,
        handlerSetup: RabbitMqHandlerOptions["setup"],
    ): RabbitMqHandlerSetupOptions {
        const serverSetup = this.#config.setup;
        const connectionSetup = connection.setup;
        const serverDl = serverSetup?.dl;
        const connectionDl = connectionSetup?.dl;
        const handlerDl = handlerSetup?.dl;
        const dl =
            !serverDl || connectionDl === false || handlerDl === false
                ? undefined
                : {
                      ...serverDl,
                      ...connectionDl,
                      ...handlerDl,
                      dlxOptions: {
                          ...serverDl.dlxOptions,
                          ...connectionDl?.dlxOptions,
                          ...handlerDl?.dlxOptions,
                      },
                      dlqOptions: {
                          ...serverDl.dlqOptions,
                          ...connectionDl?.dlqOptions,
                          ...handlerDl?.dlqOptions,
                      },
                  };

        return {
            ...serverSetup,
            ...connectionSetup,
            ...handlerSetup,
            exchangeOptions: {
                ...serverSetup?.exchangeOptions,
                ...connectionSetup?.exchangeOptions,
                ...handlerSetup?.exchangeOptions,
            },
            queueOptions: {
                ...serverSetup?.queueOptions,
                ...connectionSetup?.queueOptions,
                ...handlerSetup?.queueOptions,
            },
            publishOptions: {
                ...serverSetup?.publishOptions,
                ...connectionSetup?.publishOptions,
                ...handlerSetup?.publishOptions,
            },
            dl,
        };
    }

    #getDeadline(value: unknown): number | undefined {
        const deadline = typeof value === "number" ? value : Number(value);
        return Number.isFinite(deadline) ? deadline : undefined;
    }

    #resolveHandlerOptions(
        options: RabbitMqMethodPattern["options"],
    ): RabbitMqHandlerOptions & { timeout?: number } {
        const defaults = this.#config.handlerOptions;
        return {
            ...defaults,
            ...options,
            setup: options?.setup,
        };
    }

    #sendDirectReply(
        channel: Channel,
        message: ConsumeMessage,
        result: unknown,
        setup: RabbitMqHandlerSetupOptions,
    ) {
        const { replyTo, correlationId } = message.properties;
        if (!replyTo) {
            return;
        }

        channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(result)), {
            ...setup.publishOptions,
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
