import { createParamDecorator } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

/**
 * Decorator to extract headers from the request.
 *
 * @param upperCase - Whether to convert header names to uppercase.
 * @returns The headers map, optionally with uppercase keys.
 */
export const HeadersMap = createParamDecorator<
    boolean | undefined,
    Record<string, string | string[] | undefined>
>((upperCase, ctx) => {
    const http = ctx.switchToHttp();
    const req: FastifyRequest = http.getRequest();

    if (upperCase) {
        const upperCaseHeaders: Record<string, string | string[] | undefined> = {};
        for (const key in req.headers) {
            upperCaseHeaders[key.toUpperCase()] = req.headers[key];
        }
        return upperCaseHeaders;
    }

    return { ...req.headers };
});
