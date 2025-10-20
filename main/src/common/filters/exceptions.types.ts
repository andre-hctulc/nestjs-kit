import type { HttpException } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { CommonPayload } from "../util/responses.js";

export type CommonErrorObject = CommonPayload & {
    message: string;
    details: any;
};

export type ErrorResponseEnhance = (
    req: FastifyRequest,
    res: FastifyReply,
    exception: unknown
) => {
    headers: Record<string, string | undefined>;
};

/**
 * Maps known errors to a specific {@link CommonErrorObject} or {@link HttpException}.
 */
export type ErrorMapper = (
    exception: unknown
) => CommonErrorObject | HttpException | null | undefined | void | false;
