import { useEffect, useRef } from "react";
import { useChannelContext } from "./channel-provider.js";
import type {
    AnyPayloadMap,
    ChannelMessageInput,
    TypedChannelMessage,
} from "../../../main/src/websockets/channels.types.js";
import type { ChannelMessage } from "../../../main/src/websockets/channels.model.js";
import { createId, type MaybePromise } from "../system.js";

/**
 * Response objects are only respected when the message has {@link ChannelMessage.response_to} set.
 * @returns An optional response message
 */
export type ChannelReceiver<
    M extends AnyPayloadMap = AnyPayloadMap,
    T extends string & keyof M = string & keyof M
> = (message: TypedChannelMessage<M, T>) => MaybePromise<ChannelMessageInput | void>;
export type ChannelReceiverFilter<
    M extends AnyPayloadMap = AnyPayloadMap,
    T extends string & keyof M = string & keyof M
> = (message: TypedChannelMessage<M, T>) => boolean;

export interface ChannelMessageReceiverOptions {
    /**
     * Channel uri
     */
    uri?: string;
}

/**
 * @param type The type of the message to listen for. If null, all messages are received.
 */
export function useChannelReceiver<
    M extends AnyPayloadMap = AnyPayloadMap,
    T extends string & keyof M = string & keyof M
>(
    type: string | null,
    receiver: ChannelReceiver<M, T>,
    filter?: ChannelReceiverFilter<M, T>,
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
        socket.on("event_stc", async (message: ChannelMessage) => {
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

            const typedMessage = message as TypedChannelMessage<M, T>;

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

                    const responseMessage: ChannelMessage = {
                        id: createId(16),
                        response_to: typedMessage.id,
                        type: messageInput.type,
                        body: messageInput.body,
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
