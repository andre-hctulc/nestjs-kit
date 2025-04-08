import type { HttpException } from "@nestjs/common";

export type ErrorBody = {
    message: string;
    details: Record<string, any>;
    status: number;
};

/**
 * Maps known errors to a specific {@link ErrorBody} or {@link HttpException}.
 */
export type ErrorMapper = (exception: unknown) => ErrorBody | HttpException | null | undefined | void | false;
