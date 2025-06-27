import { useCallback, useState } from "react";
import { useChannelContext } from "./channel-provider.js";
import type { ChannelMessage } from "../../../main/src/websockets/channels.model.js";
import type {
    TypedChannelMessageInput,
    TypedChannelMessage,
    AnyPayloadMap,
} from "../../../main/src/websockets/channels.types.js";
import { createId } from "../system.js";

export interface SendOptions {
    /**
     * Max age to wait for a response
     *
     * Milliseconds
     *
     * @default 10000
     */
    responseTimeout?: number;
    expectResponse?: boolean;
    /**
     * Channel uri
     */
    uri?: string;
}

export enum ChannelMessageResolveReason {
    /**
     * Message was sent without expecting a response
     */
    SENT = "sent",
    /**
     * Message could not be sent
     */
    SEND_ERROR = "send_error",
    /**
     * Expected response timed out.
     */
    RESPONSE_TIMEOUT = "timeout",
    /**
     * Received expected response
     */
    RESPONSE = "response",
    /**
     * Received error response (status >= 400)
     */
    RESPONSE_ERROR = "error",
}

export type ChannelSenderResult = {
    resolveReason: ChannelMessageResolveReason;
    responseMessage: null | ChannelMessage;
    error: Error | null;
    messageSent: ChannelMessage | null;
};

/**
 * Sends a message to the server
 * @param sendOptions Overwrites base send options
 * @returns The response message (if any)
 */
export type ChannelSender<
    M extends AnyPayloadMap = AnyPayloadMap,
    T extends string & keyof M = string & keyof M
> = (
    type: T,
    message: Omit<TypedChannelMessageInput<M, T>, "type">,
    sendOptions?: SendOptions
) => Promise<ChannelSenderResult>;

export interface UseChannelSenderResult<
    M extends AnyPayloadMap = AnyPayloadMap,
    T extends string & keyof M = string & keyof M
> {
    send: ChannelSender<M, T>;
    /**
     * Whether a message is currently being sent
     */
    isSending: boolean;
    /**
     * The latest message that was sent
     */
    currentMessage: TypedChannelMessage<M, T> | null;
    /**
     * The latest response to the {@link currentMessage}
     */
    responseMessage: ChannelMessage | null;
    /**
     * Latest response error
     */
    responseError: Error | null;
    /**
     * Latest send error
     */
    sendError: Error | null;
}

export function useChannelSender<
    M extends AnyPayloadMap = AnyPayloadMap,
    T extends string & keyof M = string & keyof M
>(options?: SendOptions): UseChannelSenderResult<M, T> {
    const { socket } = useChannelContext(options?.uri);
    const [isSending, setIsSending] = useState(false);
    const [currentMessage, setCurrentMessage] = useState<TypedChannelMessage<M, T> | null>(null);
    const [response, setResponse] = useState<ChannelMessage | null>(null);
    const [responseError, setResponseError] = useState<Error | null>(null);
    const [sendError, setSendError] = useState<Error | null>(null);

    const send = useCallback(
        async <T extends string & keyof M>(
            type: T,
            input: Omit<TypedChannelMessageInput<M, T>, "type">,
            sendOptions?: SendOptions
        ) => {
            const message: TypedChannelMessage<M, T> = {
                ...input,
                id: createId(16),
                type,
            };

            setIsSending(true);
            setSendError(null);
            setResponseError(null);
            setCurrentMessage(message as any);
            setResponse(null);

            const expectResponse = sendOptions?.expectResponse ?? options?.expectResponse ?? false;

            try {
                socket.emit("event_cts", message);
            } catch (err) {
                const error = new Error("Failed to send message", { cause: err });

                setIsSending(false);
                setSendError(error);
                setCurrentMessage(message as any);
                setResponse(null);
                setResponseError(null);

                return {
                    resolveReason: ChannelMessageResolveReason.SEND_ERROR,
                    responseMessage: null,
                    error: error,
                    messageSent: null,
                } satisfies ChannelSenderResult;
            }

            if (!expectResponse) {
                setIsSending(false);
                setResponse(null);
                setResponseError(null);
                setCurrentMessage(message as any);
                setSendError(null);

                return {
                    resolveReason: ChannelMessageResolveReason.SENT,
                    responseMessage: null,
                    error: null,
                    messageSent: message,
                } satisfies ChannelSenderResult;
            }

            return new Promise<ChannelSenderResult>((resolve) => {
                let timedOut = false;
                const timeout = sendOptions?.responseTimeout ?? options?.responseTimeout ?? 10000;

                const to = setTimeout(() => {
                    timedOut = true;
                    const error = new Error("Timeout");

                    // Only update state if the message is still the current message
                    if (currentMessage?.id === message.id) {
                        setIsSending(false);
                        setCurrentMessage(message as any);
                        setResponse(null);
                        setResponseError(error);
                        setSendError(null);
                    }

                    resolve({
                        error,
                        responseMessage: null,
                        resolveReason: ChannelMessageResolveReason.RESPONSE_TIMEOUT,
                        messageSent: message,
                    } satisfies ChannelSenderResult);
                }, timeout);

                socket.on("event_stc", (response: ChannelMessage) => {
                    // response timed out
                    if (timedOut) {
                        return;
                    }

                    // Check if the response is for this message
                    if (response.response_to === message.id) {
                        clearTimeout(to);

                        const isCurrentMessage = currentMessage?.id === message.id;

                        // error response
                        if (response.type === "error") {
                            const error = new Error("Response error");
                            // Only update state if the message is still the current message
                            if (isCurrentMessage) {
                                setIsSending(false);
                                setCurrentMessage(message as any);
                                setResponse(response);
                                setResponseError(error);
                                setSendError(null);
                            }
                            return resolve({
                                error,
                                responseMessage: response,
                                resolveReason: ChannelMessageResolveReason.RESPONSE_ERROR,
                                messageSent: message,
                            });
                        }

                        // Only update state if the message is still the current message
                        if (isCurrentMessage) {
                            setIsSending(false);
                            setCurrentMessage(message as any);
                            setResponse(response);
                            setResponseError(null);
                            setSendError(null);
                        }

                        resolve({
                            error: null,
                            responseMessage: response,
                            resolveReason: ChannelMessageResolveReason.RESPONSE,
                            messageSent: message,
                        });
                    }
                });
            });
        },
        [socket, options?.responseTimeout, options?.expectResponse, currentMessage?.id]
    );

    return { send, isSending, currentMessage, responseMessage: response, responseError, sendError };
}
