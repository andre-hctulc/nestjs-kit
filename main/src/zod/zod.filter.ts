import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { ZodError } from "zod";
import { ErrorBody, LogLevel } from "../common/index.js";
import { log } from "../common/util/system/system-util.js";
import { RpcErrorData } from "../json-rpc/rpc.model.js";

interface ZodExceptionFilterOptions {
    /**
     * "verbose": Log all exceptions
     *
     * "error" | "info": Log only unmapped and non rpc errors
     */
    logLevel?: LogLevel;
}

@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
    private logLevel: LogLevel;

    constructor(options: ZodExceptionFilterOptions = {}) {
        this.logLevel = options.logLevel || "silent";
    }

    async catch(exception: ZodError, host: ArgumentsHost) {
        const ctxType = host.getType();
        const httpErrBody: ErrorBody = {
            message: "Param validation failed",
            details: {
                issues: exception.issues,
            },
            code: 400,
        };

        log(this.logLevel, "error", exception);

        if (ctxType === "http") {
            const http = host.switchToHttp();
            const response = http.getResponse();

            response.status(400).json(httpErrBody);
        } else if (ctxType === "rpc") {
            const { RpcException } = await import("@nestjs/microservices");
            throw new RpcException({
                code: -32602,
                message: "Invalid params",
                data: {
                    issues: exception.issues,
                },
            } satisfies RpcErrorData);
        } else {
            const { WsException } = await import("@nestjs/websockets");
            throw new WsException(httpErrBody);
        }
    }
}
