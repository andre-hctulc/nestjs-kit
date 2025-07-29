import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { JsonRpcError } from "./json-rpc.error.js";
import { JsonRpcErrorResponse } from "./json-rpc.types.js";
import { LogLevel } from "../common/index.js";
import { defaultLogLevel, log } from "../common/util/system/system-util.js";
import { FastifyReply, FastifyRequest } from "fastify";

export type JsonRpcErrorMapper = (
    error: unknown
) => JsonRpcErrorResponse | JsonRpcError | null | void | undefined;

export interface ExceptionFilterConfig {
    mapErrors?: JsonRpcErrorMapper;
    /**
     * "verbose": Log all exceptions
     *
     * "error" | "info": Log only unmapped and non http errors
     */
    logLevel?: LogLevel;
}

@Catch()
export class JsonRpcExceptionFilter implements ExceptionFilter {
    private _logLevel: LogLevel;
    private _config: ExceptionFilterConfig;

    constructor(config?: ExceptionFilterConfig) {
        this._config = config || {};
        this._logLevel = this._config.logLevel || defaultLogLevel();
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

            if (mappedError instanceof JsonRpcError) {
                userMapped = true;
                exception = mappedError;
            } else if (mappedError) {
                userMapped = true;
                exception = new JsonRpcError(
                    mappedError.error.code,
                    mappedError.error.message,
                    mappedError.error.data
                );
            }
        }

        // Only log the exception if log mode verbose or if the exception is not a HttpException
        if (this._logLevel === "verbose" || !(exception instanceof JsonRpcError)) {
            log(this._logLevel, "error", `ERR at [${req.method}] ${route}:\n`, exception);
        }

        let errRes: JsonRpcErrorResponse;

        if (exception instanceof JsonRpcError) {
            errRes = exception.createRpcErrorResponse(reqId);
        } else if (exception instanceof JsonRpcError) {
            errRes = {
                jsonrpc: "2.0",
                error: {
                    code: this._mapHttpStatusToJsonRpcCode(exception.getStatus()),
                    message: exception.message,
                },
                id: reqId,
            };
        } else {
            errRes = {
                jsonrpc: "2.0",
                error: {
                    // internal server error
                    code: -32603,
                    message: "Internal Server Error",
                },
                id: reqId,
            };
        }

        res.status(200).send(errRes);
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
