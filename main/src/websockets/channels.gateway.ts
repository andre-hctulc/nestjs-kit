import {
    SubscribeMessage,
    WebSocketServer,
    type OnGatewayInit,
    type OnGatewayConnection,
    type OnGatewayDisconnect,
    MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { UnauthorizedException } from "@nestjs/common";
import { ChannelsManager } from "./channels-manager.class.js";
import { wsErrorInput, wsInput } from "./channels.util.js";
import {
    ChannelMessageSchema,
    type ChannelMessage,
    type Channel,
    type ChannelMessageInput,
    type ChannelMessageResponse,
    type ChannelSendOptions,
    type ChannelSendResult,
} from "./channels.model.js";
import { randomUUID } from "crypto";
import type { MaybePromise } from "../common/util/system/system-types.js";

declare module "socket.io" {
    interface Socket {
        userId: string;
        clientId: string;
    }
}

const CTS_EVENT = "event_cts";
const STC_EVENT = "event_stc";
// Use function, to potentially await process env initialization in some edge cases
const DEV_MODE = () => process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

// TODO move to nestjs kit

interface AcceptedConnection {
    userId: string;
    clientId: string;
}

export interface ChannelsGatewayConfig {
    /**
     * Defaults to "verbose" in dev mode and "silent" in prod mode.
     */
    log?: "verbose" | "info" | "error" | "silent";
}

/**
 * Abstract gateway channel service driven by socket.io.
 *
 * socket.io is event driven.
 * All messages from the server to the client are handled with only one event named *event_stc*.
 * All messages from the client to the server are also handled with only one event named *event_cts*-
 *
 * The namespace should start with `/ws/`.
 * @see https://socket.io/docs/v4/namespaces/
 *
 * ### Usage
 *
 * ```ts
 * @WebSocketGateway({
 *     cors: true,
 *     namespace: "/ws/my-channel",
 * })
 * @Injectable()
 * export class MyChannel extends GatewayChannel {
 * }
 * ```
 */
export abstract class ChannelsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    private server!: Server;
    private channels: ChannelsManager = new ChannelsManager();
    private logLevel: "verbose" | "info" | "silent" | "error" = DEV_MODE() ? "verbose" : "silent";

    constructor(private config: ChannelsGatewayConfig = {}) {
        if (config.log) {
            this.logLevel = config.log;
        }
    }

    private logVerbose(...message: any[]) {
        if (this.logLevel === "verbose") {
            console.log("<WS>", ...message);
        }
    }

    private logInfo(...message: any[]) {
        if (this.logLevel === "verbose" || this.logLevel === "info") {
            console.log("<WS>", ...message);
        }
    }

    private logError(client: Socket | null, error: unknown, ...message: any[]) {
        if (this.handleError) {
            this.handleError(client, error);
        }
        if (this.logLevel !== "silent") {
            console.error("<WS>", ...message, error);
        }
    }

    /**
     * Overridable
     */
    afterInit(server: Server) {}

    /**
     * Errors are handled by the channel.
     */
    protected abstract acceptConnection(client: Socket): MaybePromise<AcceptedConnection | null>;

    /**
     * Errors are handled by the channel.
     *
     * @returns Either void or a response message.
     */
    protected abstract messageIn(
        client: Socket,
        payload: ChannelMessage
    ): MaybePromise<void | undefined | ChannelMessageResponse>;

    /**
     * Errors thrown here are **not handled**.
     */
    handleError?(client: Socket | null, error: unknown): void;

    /**
     * Errors thrown here will cause disconnection of the client.
     */
    onAcceptConnection?(client: Socket): void;

    //IMP Nest **does not** handle errors in this method!
    async handleConnection(client: Socket) {
        let accepted: AcceptedConnection | null = null;

        try {
            accepted = await this.acceptConnection(client);
        } catch (err) {
            this.logError(client, err, "Failed to accept connection");
            client.disconnect();
            return;
        }

        if (!accepted) {
            this.logError(client, null, "Connection not accepted");
            client.disconnect();
            return;
        }

        // hang up old connection. There can only be one connection per client per channel.
        if (this.channels.hasChannel(accepted.userId, accepted.clientId)) {
            const matches = this.channels.findChannels(accepted.userId, accepted.clientId);
            matches.forEach((channel) => this.channels.removeChannel(accepted.userId, channel.id));
        }

        this.channels.addChannel({
            // channel id equal to socket id
            id: client.id,
            userId: accepted.userId,
            socket: client,
            clientId: accepted.clientId,
        });

        client.userId = accepted.userId;

        try {
            this.onAcceptConnection?.(client);
        } catch (err) {
            this.logError(client, err, "Accepted callback failed");
            client.disconnect();
            return;
        }

        this.logInfo("Connected", { ...accepted, channelId: client.id });
    }

    /**
     * Removes the user from the manager on client initialized disconnect.
     * Server initialized disconnects **do not** trigger this method.
     */
    handleDisconnect(client: Socket) {
        this.channels.removeChannel(client.userId, client.id);
        this.logInfo("Disconnected", {
            channelId: client.id,
            userId: client.userId,
        });
    }

    /**
     * socket.io is event driven.
     * We handle all messages from the client to the server with one event named *event_cts*.
     *
     * @returns Handle success
     */
    @SubscribeMessage(CTS_EVENT)
    async handleMessage(client: Socket, @MessageBody() payload: any): Promise<boolean> {
        if (typeof client?.userId !== "string" || typeof client?.clientId !== "string") {
            throw new UnauthorizedException();
        }

        let responseMessage: ChannelMessageInput | undefined;

        try {
            const message = ChannelMessageSchema.parse(payload);
            const res = await this.messageIn(client, message);

            if (res) {
                responseMessage = { ...res.response, response_to: message.id };
            }

            this.logVerbose(client.id, "Message in", {
                channelId: client.id,
                userId: client.userId,
                payload,
            });
        } catch (err) {
            this.logError(client, err, "Message parse failed");
            this.sendToChannel(client.userId, client.id, wsErrorInput(err));
            return false;
        }

        if (responseMessage) {
            const responded = await this.sendToChannel(client.userId, client.id, responseMessage);
            return !!responded;
        }

        return true;
    }

    /**
     * Send a message to a user by channel id.
     *
     * Use {@link wsInput} to create typed messages.
     */
    async sendToChannel(
        userId: string,
        channelId: string,
        message: ChannelMessageInput,
        options?: ChannelSendOptions
    ): Promise<ChannelSendResult> {
        const channel = this.channels.getChannel(userId, channelId);

        // ignore Channel not found
        if (!channel) {
            this.logError(null, null, "Send failed: Channel not found", { userId, channelId });
            return { success: false };
        }

        const messageId = randomUUID();
        let responseMessage: ChannelMessage | undefined;

        try {
            channel.socket.emit(STC_EVENT, {
                ...message,
                id: messageId,
                expect_response: message?.expect_response ?? !!options?.expectResponse,
            });
            this.logVerbose("Sent to channel", { channelId, userId });
        } catch (err) {
            this.logError(channel.socket, err, "Send to channel failed", { userId, channelId });
            return { success: false };
        }

        if (options?.expectResponse) {
            let responseListener: ((payload: any) => void) | undefined;

            try {
                responseMessage = await new Promise<ChannelMessage>((resolve, reject) => {
                    setTimeout(() => {
                        reject(new Error("Response timeout"));
                    }, options.responseTimeout || 10000);

                    channel.socket.on(
                        CTS_EVENT,
                        (responseListener = (payload: any) => {
                            // Is response to this message?
                            if (payload?.response_to !== messageId) {
                                return;
                            }

                            const message = ChannelMessageSchema.parse(payload);

                            if (!message) {
                                return reject(new Error("Invalid response"));
                            }

                            resolve(message);
                        })
                    );
                });

                this.logVerbose("Received response from channel", { channelId, userId });
            } catch (err) {
                this.logError(channel.socket, err, "Send to channel failed: Timeout", { userId, channelId });
                return { success: false };
            } finally {
                // IMP remove response listener
                if (responseListener) {
                    channel.socket.off(CTS_EVENT, responseListener);
                }
            }
        }

        return { success: true, response: responseMessage };
    }

    /**
     * Use {@link wsInput} to create typed messages.
     */
    sendToClient(
        userId: string,
        clientId: string,
        message: ChannelMessageInput,
        options?: ChannelSendOptions
    ): Promise<ChannelSendResult> {
        const channel = this.channels.getChannel(userId, clientId);
        return this.sendToChannel(userId, channel?.id || "", message, options);
    }

    /**
     * Send a message to all clients of a user.
     *
     * Use {@link wsInput} to create typed messages.
     *
     * @param clientId The client id, or null for all user clients
     */
    sendToUser(
        userId: string,
        payload: ChannelMessageInput,
        options?: ChannelSendOptions
    ): Promise<ChannelSendResult[]> {
        const channels = this.channels.findChannels(userId, null);

        return Promise.all(
            channels.map((channel) => {
                return this.sendToChannel(userId, channel.id, payload, options);
            })
        );
    }

    /**
     * Broadcast to all connected clients.
     *
     * Use {@link wsInput} to create typed messages.
     *
     * @returns Send success
     */
    broadcast(payload: ChannelMessageInput): boolean {
        if (!payload.source) {
            payload.source = "system";
        }

        try {
            this.server.emit(STC_EVENT, { ...payload, id: randomUUID() });
            return true;
        } catch (err) {
            this.logError(null, err, "Broadcast failed");
            return false;
        }
    }

    findUserChannels(userId: string, clientId: string | null): Channel[] {
        return this.channels.findChannels(userId, clientId);
    }
}
