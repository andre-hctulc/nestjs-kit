import { HttpException } from "@nestjs/common";
import type { AnyPayloadMap, ChannelMessageInput, TypedChannelMessageInput } from "./channels.types.js";
import { mapException, type ErrorBody, type ErrorMapper } from "@dre44/nestjs-kit";

/**
 * Creates an error channel message input from an exception.
 * Uses {@link mapException} to create the _body_ ({@link ErrorBody}).
 *
 * Default _status_ is 500 and the default _type_ is "error".
 *
 * @param exception If {@link HttpException} is passed, the status and message will be taken from it.
 * @param message Optional message to override the default message with.
 */
export function createErrorMessage(
    exception: unknown,
    message?: Partial<Omit<ChannelMessageInput, "error">>,
    mapError?: ErrorMapper
): ChannelMessageInput {
    const errorBody = mapException(exception, mapError);

    return {
        body: errorBody,
        type: "error",
        status: errorBody.code ?? 500,
        ...message,
        error: true,
    };
}

export function tInput<M extends AnyPayloadMap, T extends string & keyof M>(
    type: T,
    input: Omit<TypedChannelMessageInput<M, T>, "type">
): TypedChannelMessageInput<M, T> {
    return { ...input, type };
}
