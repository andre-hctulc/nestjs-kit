import type { Socket } from "socket.io";
import type { ChannelMessage } from "./channels.model.js";

/**
 * Channels are tied to/identified by a client (device), the user and a type.
 * Each channel variation can only exist once.
 */
export interface Channel {
    /**
     * Unique channel ID. Equals the socket id.
     */
    id: string;
    userId: string;
    /**
     * Obtained from te client id cookie.
     */
    clientId: string;
    spaceId?: string;
    socket: Socket;
}

export interface ChannelSendOptions {
    expectResponse?: boolean;
    /**
     * Timeout in ms for the response
     * @default 10000
     */
    responseTimeout?: number;
}

export type ChannelSendResult = { success: boolean; response?: ChannelMessage };

export type ChannelMessageInput = Omit<ChannelMessage, "id">;

/**
 * @template T Message Type.
 * @template M Message-Payload Map.
 */
export type TypedChannelMessage<M extends object, T extends string & keyof M> = Omit<
    ChannelMessage,
    "body" | "type"
> & { body: M[T]; type: T };
export type TypedChannelMessageInput<M extends object, T extends string & keyof M> = Omit<
    TypedChannelMessage<M, T>,
    "id"
>;

export type ChannelMessageResponse = { response: Omit<ChannelMessageInput, "response_to"> };

export type AnyPayloadMap = Record<string, Record<string, any>>;
