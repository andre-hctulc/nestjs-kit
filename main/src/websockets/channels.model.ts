import type { CommonPayload } from "../common/index.js";

export type WSMessage = CommonPayload & {
    id?: string;
    response_to?: string;
};


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
