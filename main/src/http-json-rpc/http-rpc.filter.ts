import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from "@nestjs/common";
import type { ErrorResponseEnhance, LogLevel } from "../common/index.js";
import { defaultLogLevel, log } from "../common/util/system/system-util.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { RpcErrorData, RpcErrorResponse } from "../json-rpc/rpc.model.js";

export type JsonRpcErrorMapper = (error: unknown) => RpcErrorData | null | void | undefined;

export interface HttpRpcExceptionFilterConfig {
    mapErrors?: JsonRpcErrorMapper;
    enhanceResponse?: ErrorResponseEnhance;
    /**
     * Exceptions with this status are ignored by the filter.
     *
     * @default [401, 403, 422]
     */
    transportStatusCodes?: number[];
    /**
     * "verbose": Log all exceptions
     *
     * "error" | "info": Log only unmapped and non rpc errors
     */
    logLevel?: LogLevel;
}

const TransportHttpErrorCodes: number[] = [/* 400, */ 401, 403, /* 404, */ 422];

/**
 * Catches all errors and maps them to JSON-RPC error responses.
 */
@Catch()
export class HttpRpcExceptionFilter implements ExceptionFilter {
    private _logLevel: LogLevel;
    private _config: HttpRpcExceptionFilterConfig;
    private _transportStatusCodes: number[];

    constructor(config?: HttpRpcExceptionFilterConfig) {
        this._config = config || {};
        this._logLevel = this._config.logLevel || defaultLogLevel();
        this._transportStatusCodes = this._config.transportStatusCodes || TransportHttpErrorCodes;
    }

    /**
     * Check if the error is an instance of `RpcException` **without importing the class**.
     */
    private _isRpcException(err: any): err is { getData: () => string | object } {
        return (
            err && typeof err === "object" && typeof err.getData === "function" && err.name === "RpcException"
        );
    }

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse<FastifyReply>();
        const req = ctx.getRequest<FastifyRequest>();
        const route = req.url;
        const body: Record<string, any> = req.body || {};
        const reqId = typeof body?.id === "string" ? body?.id : null;

        let status = 200;
        let errData: RpcErrorData | undefined;

        if (this._config.mapErrors) {
            const mappedError = this._config.mapErrors(exception);

            if (mappedError) {
                errData = mappedError;
            }
        }

        const isRpcError = this._isRpcException(exception);

        log(
            this._logLevel,
            !isRpcError ? "verbose" : "error",
            `ERR <http_rpc> at [${req.method}] ${route}:\n`,
            exception
        );

        if (errData) {
        } else if (isRpcError) {
            const d = exception.getData() as RpcErrorData;
            if (typeof d === "object" && d !== null) {
                errData = d;
            } else {
                errData = {
                    code: -32000,
                    message: "Internal Server Error",
                    data: {},
                };
            }
        } else if (exception instanceof HttpException) {
            // Prevent sending transport errors as json-rpc errors, which is not desired
            if (this._transportStatusCodes.includes(exception.getStatus())) {
                // Pass to next filter
                throw exception;
            }

            errData = {
                code: HttpRpcExceptionFilter.mapHttpStatusToRpcCode(exception.getStatus()),
                message: exception.message,
                data: {},
            };
        } else {
            errData = {
                // internal server error
                code: -32000,
                message: "Internal Server Error",
                data: {},
            };
        }

        const { headers } = this._config.enhanceResponse
            ? this._config.enhanceResponse(req, res, exception)
            : { headers: {} };

        Object.entries(headers).forEach(([key, value]) => {
            if (value !== undefined) {
                res.header(key, value);
            }
        });

        res.status(status).send({
            jsonrpc: "2.0",
            error: errData,
            id: reqId,
        } satisfies RpcErrorResponse);
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
