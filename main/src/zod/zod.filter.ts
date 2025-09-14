import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { ZodError } from "zod";
import { ErrorBody } from "../common/index.js";

@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
    async catch(exception: ZodError, host: ArgumentsHost) {
        const ctxType = host.getType();
        const errorBody: ErrorBody = {
            message: "Param validation failed",
            details: {
                issues: exception.issues,
            },
            status: 400,
        };

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
