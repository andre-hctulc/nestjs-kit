import { type ArgumentsHost, Catch, type ExceptionFilter } from "@nestjs/common";
import { ZodError } from "zod";
import type { CommonErrorObject, LogLevel } from "../common/index.js";
import { log } from "../common/util/system/system-util.js";
import type { RpcErrorData } from "../json-rpc/rpc.model.js";

interface ZodExceptionFilterOptions {
    /**
     * "verbose": Log all exceptions
     *
     * "error" | "info": Log only unmapped and non rpc errors
     */
    logLevel?: LogLevel;
}

/**
 * Zod exception filter that maps ZodErrors to appropriate HTTP, RPC, or WS error responses.
 */
@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
    private logLevel: LogLevel;

    constructor(options: ZodExceptionFilterOptions = {}) {
        this.logLevel = options.logLevel || "silent";
    }

    async catch(exception: ZodError, host: ArgumentsHost) {
        const ctxType = host.getType();
        const errObj: CommonErrorObject = {
            error: "Param validation failed",
            data: {
                issues: exception.issues,
            },
            code: 400,
        };

        log(this.logLevel, "error", exception);

        if (ctxType === "http") {
            const http = host.switchToHttp();
            const res = http.getResponse();
            res.status(400).json(errObj);
        } else if (ctxType === "rpc") {
            const { RpcException } = await import("@nestjs/microservices");
            throw new RpcException({
                code: -32602,
                message: errObj.error,
                data: errObj.data,
            } satisfies RpcErrorData);
        } else {
            const { WsException } = await import("@nestjs/websockets");
            throw new WsException(errObj);
        }
    }
}
