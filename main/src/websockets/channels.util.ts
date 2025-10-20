import type { AnyPayloadMap, ChannelMessageInput, TypedChannelMessageInput } from "./channels.model.js";
import { objectToErrorObject } from "@dre44/nestjs-kit";
import { WsException } from "@nestjs/websockets";

/**
 * Creates an error channel message input from an exception.
 */
export function wsErrorInput(
    exception: unknown,
    message?: Partial<Omit<ChannelMessageInput, "error">>
): ChannelMessageInput {
    let inp: ChannelMessageInput;

    if (exception instanceof WsException) {
        const errData = exception.getError();
        const errObj = objectToErrorObject(errData);
        return {
            ...errObj,
            data: undefined,
            type: "error",
            ...message,
        };
    } else {
        inp = {
            data: undefined,
            details: {},
            type: "error",
            ...message,
        };
    }

    return inp;
}

export function wsInput<M extends AnyPayloadMap, T extends string & keyof M>(
    type: T,
    input: Omit<TypedChannelMessageInput<M, T>, "type">
): TypedChannelMessageInput<M, T> {
    return { ...input, type };
}
