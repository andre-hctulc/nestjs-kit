import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { HttpRpcError } from "./http-rpc.error.js";
import { ErrorResponseEnhance, LogLevel } from "../common/index.js";
import { defaultLogLevel, log } from "../common/util/system/system-util.js";
import { FastifyReply, FastifyRequest } from "fastify";
import { JsonRpcErrorResponse } from "./json-rpc.model.js";

export type JsonRpcErrorMapper = (
    error: unknown
) => JsonRpcErrorResponse | HttpRpcError | null | void | undefined;

export interface HttpRpcExceptionFilterConfig {
    mapErrors?: JsonRpcErrorMapper;
    enhanceResponse?: ErrorResponseEnhance;
    /**
     * Exceptions with this status are ignored by the filter.
     *
     * @default [400, 401, 403, 404, 422]
     */
    transportStatusCodes?: number[];
    /**
     * "verbose": Log all exceptions
     *
     * "error" | "info": Log only unmapped and non rpc errors
     */
    logLevel?: LogLevel;
}

const TransportHttpErrorCodes: number[] = [400, 401, 403, 404, 422];

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

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse<FastifyReply>();
        const req = ctx.getRequest<FastifyRequest>();
        const route = req.url;

        const reqId = (req.body as any)?.id ?? null;

        let userMapped = false;

        if (this._config.mapErrors) {
            const mappedError = this._config.mapErrors(exception);

            if (mappedError instanceof HttpRpcError) {
                userMapped = true;
                exception = mappedError;
            } else if (mappedError) {
                userMapped = true;
                exception = new HttpRpcError(
                    mappedError.error.status,
                    mappedError.error.message,
                    mappedError.error.details
                );
            }
        }

        const isUnexpectedError = !(exception instanceof HttpRpcError) || exception.getStatus() >= 500;
        log(
            this._logLevel,
            isUnexpectedError ? "verbose" : "error",
            `ERR at [${req.method}] ${route}:\n`,
            exception
        );

        let errRes: JsonRpcErrorResponse;
        let status: number = 200;

        if (exception instanceof HttpRpcError) {
            errRes = exception.createRpcErrorResponse(reqId);
            status = exception.getStatus();
        } else if (exception instanceof HttpException) {
            if (this._transportStatusCodes.includes(exception.getStatus())) {
                // Pass to next filter
                throw exception;
            }

            // Map HttpException to JsonRpcErrorResponse
            errRes = {
                jsonrpc: "2.0",
                error: {
                    status: this._mapHttpStatusToJsonRpcCode(exception.getStatus()),
                    message: exception.message,
                    details: {},
                },
                id: reqId,
            };
            // Use default http status
            status = 200;
        } else {
            errRes = {
                jsonrpc: "2.0",
                error: {
                    // internal server error
                    status: -32603,
                    message: "Internal Server Error",
                    details: {},
                },
                id: reqId,
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

        (errRes.error as any).code = errRes.error.status;

        res.status(status).send(errRes);
    }

    private _mapHttpStatusToJsonRpcCode(httpStatus: number): number {
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
            case 401:
            case 403:
                return -32000;
            // Internal error
            default:
                return -32603;
        }
    }
}
