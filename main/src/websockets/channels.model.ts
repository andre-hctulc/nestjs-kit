import type { Socket } from "socket.io";
import type { CommonPayload } from "../common/index.js";

export type WSMessage = CommonPayload & {
    id?: string;
    response_to?: string;
};

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

export type ChannelSendResult = { success: boolean; responseMessage?: any };

export type ChannelMessageResponse = { response: WSMessage };

export type AnyPayloadMap = Record<string, Record<string, any>>;
