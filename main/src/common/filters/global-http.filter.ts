import { Catch, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import { GlobalExceptionFilterBase } from "./global-exception-filter-base.filter.js";
import type { CommonErrorObject } from "../util/payloads.util.js";
import type { FastifyRequest } from "fastify";

/**
 * Catches all errors and maps them to a {@link CommonErrorObject}
 * which is sent to the client as a JSON response.
 */
@Catch()
export class GlobalHttpExceptionFilter extends GlobalExceptionFilterBase<void> implements ExceptionFilter {
    constructor() {
        super();
    }

    protected at(host: ArgumentsHost): string {
        const MAX_URL_DISPLAY_LENGTH = 100;
        const ctx = host.switchToHttp();
        const req: FastifyRequest = ctx.getRequest();
        const urlStr =
            req.url.length > MAX_URL_DISPLAY_LENGTH
                ? `${req.url.slice(0, MAX_URL_DISPLAY_LENGTH)}...`
                : req.url;
        return `(${req.method.toUpperCase()}) ${urlStr}`;
    }
}
