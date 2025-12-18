import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { ErrorResponseEnhance } from "./exceptions.types.js";
import {
    GlobalExceptionFilterBase,
    type GlobalExceptionFilterConfig,
} from "./global-exception-filter-base.filter.js";
import type { CommonErrorObject } from "../util/payloads.util.js";
import type { FastifyReply, FastifyRequest } from "fastify";

export interface HttpExceptionFilterConfig extends GlobalExceptionFilterConfig {
    enhanceResponse?: ErrorResponseEnhance;
}

/**
 * Catches all errors and maps them to a {@link CommonErrorObject}
 * which is sent to the client as a JSON response.
 */
@Catch()
export class GlobalHttpExceptionFilter extends GlobalExceptionFilterBase<void> implements ExceptionFilter {
    #config: HttpExceptionFilterConfig;

    constructor(config: HttpExceptionFilterConfig = {}) {
        super(config, { defaultErrorCode: -1 });
        this.#config = config || {};
    }

    sendError(exception: unknown, mappedException: unknown, error: CommonErrorObject, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const res: FastifyReply = ctx.getResponse();
        const req: FastifyRequest = ctx.getRequest();

        const { headers } = this.#config.enhanceResponse
            ? this.#config.enhanceResponse(req, res, exception)
            : { headers: {} };

        Object.entries(headers).forEach(([key, value]) => {
            if (value !== undefined) {
                res.header(key, value);
            }
        });

        const status =
            mappedException instanceof HttpException
                ? mappedException.getStatus()
                : exception instanceof HttpException
                ? exception.getStatus()
                : 500;

        if (error.code == null || error.code === "" || error.code === -1) {
            error.code = status;
        }

        return res.code(status).send(error);
    }

    protected at(host: ArgumentsHost): string {
        const MAX_URL_DISPLAY_LENGTH = 100;
        const ctx = host.switchToHttp();
        const req: FastifyRequest = ctx.getRequest();
        const urlStr =
            req.url.length > MAX_URL_DISPLAY_LENGTH
                ? `${req.url.slice(0, MAX_URL_DISPLAY_LENGTH)}...`
                : req.url;
        return `HTTP (${req.method.toUpperCase()}) ${urlStr}`;
    }
}
