import { Catch, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
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
        super(config, {});
        this.#config = config || {};
    }

    sendError(exception: unknown, error: CommonErrorObject, host: ArgumentsHost) {
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

        return res.code(Number(error.code ?? 500)).send(error);
    }

    protected at(host: ArgumentsHost): string {
        const ctx = host.switchToHttp();
        const req: FastifyRequest = ctx.getRequest();
        return `HTTP [${req.method}] ${req.url.slice(0, 60)}`;
    }
}
