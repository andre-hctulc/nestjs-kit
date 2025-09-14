import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { ZodError } from "zod";
import { ErrorBody, LogLevel } from "../common/index.js";
import { log } from "../common/util/system/system-util.js";

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

    constructor(private options?: ZodExceptionFilterOptions) {
        this.logLevel = options?.logLevel || "verbose";
    }

    async catch(exception: ZodError, host: ArgumentsHost) {
        const ctxType = host.getType();
        const errorBody: ErrorBody = {
            message: "Param validation failed",
            details: {
                issues: exception.issues,
            },
            status: 400,
        };

        log(this.logLevel, "error", exception);

        if (ctxType === "http") {
            const http = host.switchToHttp();
            const response = http.getResponse();

            response.status(400).json(errorBody);
        } else if (ctxType === "rpc") {
            const { RpcException } = await import("@nestjs/microservices");
            throw new RpcException(errorBody);
        } else {
            const { WsException } = await import("@nestjs/websockets");
            throw new WsException(errorBody);
        }
    }
}
