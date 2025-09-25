import type { HttpException } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";

export type ErrorBody = {
    message: string;
    details: any;
    code: string | number;
};

export type ErrorResponseEnhance = (
    req: FastifyRequest,
    res: FastifyReply,
    exception: unknown
) => {
    headers: Record<string, string | undefined>;
};
/**
 * Maps known errors to a specific {@link ErrorBody} or {@link HttpException}.
 */
export type ErrorMapper = (exception: unknown) => ErrorBody | HttpException | null | undefined | void | false;
