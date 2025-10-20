import type { Socket } from "socket.io";
import { z } from "zod";

export const ChannelMessageSchema = z.object({
    /**
     * Unique message id
     */
    id: z.string(),
    /**
     * Message id
     */
    response_to: z.string().optional(),
    /**
     * Defaults to `expectResponse` option if not set.
     */
    expect_response: z.boolean().optional(),
    type: z.string(),
    code: z.number().or(z.string()).optional(),
    error: z.any().optional(),
    data: z.any(),
    details: z.record(z.string(), z.any()).optional(),
    /**
     * Generic target for the event.
     */
    target: z.string().optional(),
    /**
     * Generic source for the event.
     */
    source: z.string().optional(),
});
export type ChannelMessage = z.infer<typeof ChannelMessageSchema>;

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
    "data" | "type"
> & { data: M[T]; type: T };
export type TypedChannelMessageInput<M extends object, T extends string & keyof M> = Omit<
    TypedChannelMessage<M, T>,
    "id"
>;

export type ChannelMessageResponse = { response: Omit<ChannelMessageInput, "response_to"> };

export type AnyPayloadMap = Record<string, Record<string, any>>;
