import { Catch, ArgumentsHost, RpcExceptionFilter } from "@nestjs/common";
import { LogLevel } from "../common/util/types.js";
import { defaultLogLevel, log } from "../common/util/system/system-util.js";
import { Observable, throwError } from "rxjs";
import { RpcException } from "@nestjs/microservices";
import { RpcErrorData } from "./rpc.model.js";

export type JsonRpcErrorMapper = (
    error: unknown
) => Observable<any> | RpcException | RpcErrorData | null | void | undefined;

export interface GlobalRpcExceptionFilterConfig {
    mapErrors?: JsonRpcErrorMapper;
    /**
     * "verbose": Log all exceptions
     *
     * "error" | "info": Log only unmapped and non rpc errors
     */
    logLevel?: LogLevel;
}

/**
 * Maps all exceptions to {@link RpcException}s and sends them.
 */
@Catch()
export class GlobalRpcExceptionFilter implements RpcExceptionFilter {
    private _config: GlobalRpcExceptionFilterConfig;
    private _logLevel: LogLevel;

    constructor(config?: GlobalRpcExceptionFilterConfig) {
        this._config = config || {};
        this._logLevel = this._config.logLevel || defaultLogLevel();
    }

    catch(exception: unknown, host: ArgumentsHost): Observable<any> {
        if (this._config.mapErrors) {
            const mappedError = this._config.mapErrors(exception);

            if (mappedError instanceof Observable) {
                return mappedError;
            }

            if (mappedError instanceof RpcException) {
                exception = mappedError;
            } else if (mappedError) {
                exception = new RpcException(mappedError);
            }
        }

        const isUnexpectedError = !(exception instanceof RpcException);
        log(this._logLevel, isUnexpectedError ? "verbose" : "error", `ERR at RPC handler:\n`, exception);

        if (isUnexpectedError) {
            exception = new RpcException({
                code: -32000,
                message: "Internal Server Error",
                data: {},
            } satisfies RpcErrorData);
        }

        return throwError(() => exception);
    }
}
