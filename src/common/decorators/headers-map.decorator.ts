import { createParamDecorator } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { convertCasing, type Casing } from "../util/system/system.util.js";

/**
 * Decorator to extract headers from the request.
 *
 * @param casing The casing to apply to header names. Defaults to "original" (no conversion).
 * @returns The headers map, optionally with converted key casing.
 */
export const HeadersMap = createParamDecorator<
    Casing | undefined,
    Record<string, string | string[] | undefined>
>((casing, ctx) => {
    const http = ctx.switchToHttp();
    const req: FastifyRequest = http.getRequest();

    if (!casing || casing === "original") {
        return req.headers;
    }

    return Object.fromEntries(
        Object.entries(req.headers).map(([key, value]) => [convertCasing(key, casing), value]),
    );
});
