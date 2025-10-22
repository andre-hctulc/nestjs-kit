import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from "@nestjs/common";
import type { CommonErrorObject, ErrorResponseEnhance } from "../common/index.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { RpcErrorData, RpcErrorResponse } from "../json-rpc/rpc.model.js";
import {
    GlobalExceptionFilterBase,
    type GlobalExceptionFilterConfig,
} from "../common/filters/global-exception-filter-base.filter.js";

export type JsonRpcErrorMapper = (error: unknown) => RpcErrorData | null | void | undefined;

export interface HttpRpcExceptionFilterConfig extends GlobalExceptionFilterConfig {
    /**
     * Exceptions with this status are ignored by the filter.
     *
     * @default [401, 403, 422]
     */
    transportStatusCodes?: number[];
    enhanceResponse?: ErrorResponseEnhance;
}

const TransportHttpErrorCodes: number[] = [/* 400, */ 401, 403, /* 404, */ 422];

/**
 * Catches all errors and maps them to JSON-RPC error responses.
 */
@Catch()
export class GlobalHttpRpcExceptionFilter extends GlobalExceptionFilterBase<void> implements ExceptionFilter {
    #config: HttpRpcExceptionFilterConfig;
    #transportStatusCodes: number[];

    constructor(config: HttpRpcExceptionFilterConfig = {}) {
        super(config, { defaultErrorCode: -32000 });
        this.#config = config || {};
        this.#transportStatusCodes = this.#config.transportStatusCodes || TransportHttpErrorCodes;
    }

    protected override sendError(
        originalException: unknown,
        mappedException: unknown,
        error: CommonErrorObject,
        host: ArgumentsHost
    ): void {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse<FastifyReply>();
        const req = ctx.getRequest<FastifyRequest>();
        const body: Record<string, any> = req.body || {};
        const reqId = typeof body?.id === "string" ? body?.id : null;
        const status =
            mappedException instanceof HttpException
                ? mappedException.getStatus()
                : originalException instanceof HttpException
                ? originalException.getStatus()
                : 500;

        let code = Number(error.code ?? status);
        if (isNaN(code)) {
            code = status;
        }

        if (code < 600) {
            code = GlobalHttpRpcExceptionFilter.mapHttpStatusToRpcCode(code);
        }

        const errData: RpcErrorData = {
            code,
            message: error.error || error.message || "Internal Server Error",
            data: error.details || {},
        };

        const { headers } = this.#config.enhanceResponse
            ? this.#config.enhanceResponse(req, res, originalException)
            : { headers: {} };

        Object.entries(headers).forEach(([key, value]) => {
            if (value !== undefined) {
                res.header(key, value);
            }
        });

        const resStatus = this.#transportStatusCodes.includes(status) ? status : 200;

        res.status(resStatus).send({
            jsonrpc: "2.0",
            error: errData,
            id: reqId,
        } satisfies RpcErrorResponse);
    }

    protected override at(host: ArgumentsHost): string {
        const ctx = host.switchToHttp();
        const req: FastifyRequest = ctx.getRequest();
        return `HTTP_RPC [${req.method}] ${req.url.slice(0, 60)}`;
    }

    static mapHttpStatusToRpcCode(httpStatus: number): number {
        switch (httpStatus) {
            // Invalid Request
            case 400:
                return -32600;
            // Method not found
            case 404:
                return -32601;
            // Invalid params
            case 422:
                return -32602;
            // Server error (custom range)
            default:
                return -32000;
        }
    }
}
