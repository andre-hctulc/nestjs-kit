import { type ArgumentsHost, Catch, ConsoleLogger, type ExceptionFilter } from "@nestjs/common";
import { ZodError } from "zod";
import type { CommonErrorObject } from "../common/index.js";
import type { RpcErrorData } from "../rpc/rpc.model.js";
import type { ZPipe } from "./zod.pipe.js";
import { ZodPipeError } from "./zod-pipe.error.js";

/**
 * Zod exception filter that exclusively handles {@link ZodPipeError}s thrown by {@link ZPipe}.
 */
@Catch(ZodPipeError)
export class ZodPipeExceptionFilter implements ExceptionFilter {
    #logger = new ConsoleLogger(this.constructor.name);

    constructor() {}

    async catch(exception: ZodError, host: ArgumentsHost) {
        const ctxType = host.getType();
        const errObj: CommonErrorObject = {
            error: "Param validation failed",
            data: {
                issues: exception.issues,
            },
            code: 400,
        };

        this.#logger.error(exception);

        if (ctxType === "http") {
            const http = host.switchToHttp();
            const res = http.getResponse();
            res.code(400).send(errObj);
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
