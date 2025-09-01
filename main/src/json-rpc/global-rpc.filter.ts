import { Catch, ArgumentsHost, RpcExceptionFilter } from "@nestjs/common";
import { LogLevel } from "../common/util/types.js";
import { defaultLogLevel, log } from "../common/util/system/system-util.js";
import { Observable, throwError } from "rxjs";
import { RpcException } from "@nestjs/microservices";
import { CommonRpcErrorBody } from "./rpc.types.js";

export type JsonRpcErrorMapper = (
    error: unknown
) => Observable<any> | RpcException | CommonRpcErrorBody | null | void | undefined;

export interface RpcExceptionFilterConfig {
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
    private _config: RpcExceptionFilterConfig;
    private _logLevel: LogLevel;

    constructor(config?: RpcExceptionFilterConfig) {
        this._config = config || {};
        this._logLevel = this._config.logLevel || defaultLogLevel();
    }

    catch(exception: unknown, host: ArgumentsHost): Observable<any> {
        let userMapped = false;

        if (this._config.mapErrors) {
            const mappedError = this._config.mapErrors(exception);

            if (mappedError instanceof Observable) {
                return mappedError;
            }

            if (mappedError instanceof RpcException) {
                userMapped = true;
                exception = mappedError;
            } else if (mappedError) {
                userMapped = true;
                exception = new RpcException(mappedError);
            }
        }

        const isUnexpectedError = !(exception instanceof RpcException);
        log(this._logLevel, isUnexpectedError ? "verbose" : "error", `ERR:\n`, exception);

        if (isUnexpectedError) {
            exception = new RpcException({
                code: 500,
                message: "Internal Server Error",
            } satisfies CommonRpcErrorBody);
        }

        return throwError(() => exception);
    }
}
