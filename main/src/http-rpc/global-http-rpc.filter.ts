import { type ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import type { CommonErrorObject } from "../common/index.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { RpcErrorData, RpcErrorResponse } from "../rpc/rpc.model.js";
import { GlobalExceptionFilterBase } from "../common/filters/global-exception-filter-base.filter.js";

export type JsonRpcErrorMapper = (error: unknown) => RpcErrorData | null | void | undefined;

const HTTP_TRANSPORT_ERROR_CODES: number[] = [/* 400, */ 401, 403, /* 404, */ 422];

/**
 * Catch all errors and map them to JSON-RPC error responses.
 */
@Catch()
export class GlobalHttpRpcExceptionFilter extends GlobalExceptionFilterBase<void> {
    protected override async sendError(
        host: ArgumentsHost,
        error: CommonErrorObject,
        originalException: unknown,
    ) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse<FastifyReply>();
        const req = ctx.getRequest<FastifyRequest>();
        const body: Record<string, any> = req.body || {};
        const reqId = typeof body?.id === "string" ? body?.id : null;
        const status = originalException instanceof HttpException ? originalException.getStatus() : 500;

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

        const resStatus = HTTP_TRANSPORT_ERROR_CODES.includes(status) ? status : 200;

        res.code(resStatus).send({
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
