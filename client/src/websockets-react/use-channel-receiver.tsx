import { useEffect, useRef } from "react";
import { useChannelContext } from "./channel-provider.js";
import type { WSMessage } from "../../../main/src/websockets/channels.model.js";
import { createId, type MaybePromise } from "../system.js";

/**
 * Response objects are only respected when the message has {@link ChannelMessage.response_to} set.
 * @returns An optional response message
 */
export type ChannelReceiver = (message: WSMessage) => MaybePromise<WSMessage | void>;

export type ChannelReceiverFilter = (message: WSMessage) => boolean;

export interface ChannelMessageReceiverOptions {
    /**
     * Channel uri
     */
    uri?: string;
}

/**
 * @param type The type of the message to listen for. If null, all messages are received.
 */
export function useChannelReceiver(
    type: string | null,
    receiver: ChannelReceiver,
    filter?: ChannelReceiverFilter,
    options?: ChannelMessageReceiverOptions
) {
    const { socket } = useChannelContext(options?.uri);
    const filterRef = useRef(filter);
    const receiverRef = useRef(receiver);

    useEffect(() => {
        filterRef.current = filter;
    }, [filter]);

    useEffect(() => {
        receiverRef.current = receiver;
    }, [receiver]);

    useEffect(() => {
        socket.on("event_stc", async (message: WSMessage) => {
            // Naive check for message object
            if (
                typeof message !== "object" ||
                typeof message.id !== "string" ||
                typeof message.type !== "string"
            ) {
                return;
            }

            // Check if message type matches
            if (type !== null && message.type !== type) {
                return;
            }

            const typedMessage = message as WSMessage;

            // Apply filter
            if (filterRef.current && !filterRef.current(typedMessage)) {
                return;
            }

            // Call receiver callback
            receiverRef.current?.(typedMessage);

            if (typedMessage.response_to) {
                // Handle response
                const receiverResult = await receiverRef.current?.(typedMessage);

                if (receiverResult) {
                    const messageInput = receiverResult;

                    const responseMessage: WSMessage = {
                        id: createId(16),
                        response_to: typedMessage.id,
                        type: messageInput.type,
                        data: messageInput.data,
                        target: messageInput.target,
                        source: messageInput.source,
                    };

                    socket.emit("event_cts", responseMessage);
                }
            }
        });

        return () => {
            socket.off("message");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket]);
}
