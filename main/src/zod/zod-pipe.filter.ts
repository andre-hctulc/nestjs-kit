import { type ArgumentsHost, Catch, ConsoleLogger, type ExceptionFilter } from "@nestjs/common";
import { ZodError } from "zod";
import type { CommonErrorObject } from "../common/index.js";
import type { ZPipe } from "./zod.pipe.js";
import { ZPipeError } from "./zod-pipe.error.js";

/**
 * Zod exception filter that exclusively handles {@link ZPipeError}s thrown by {@link ZPipe}s.
 */
@Catch(ZPipeError)
export class ZPipeExceptionFilter implements ExceptionFilter {
    #logger = new ConsoleLogger(this.constructor.name);

    constructor() {}

    async catch(exception: ZodError, host: ArgumentsHost) {
        const ctxType = host.getType();
        const errObj: CommonErrorObject = {
            message: "Param validation failed",
            details: {
                issues: exception.issues,
            },
            code: "PARAM_VALIDATION_FAILED",
        };

        this.#logger.error(exception);

        if (ctxType === "http") {
            const http = host.switchToHttp();
            const res = http.getResponse();
            res.code(400).send(errObj);
        } else if (ctxType === "rpc") {
            const { RpcException } = await import("@nestjs/microservices");
            throw new RpcException(errObj);
        } else {
            const { WsException } = await import("@nestjs/websockets");
            throw new WsException(errObj);
        }
    }
}
