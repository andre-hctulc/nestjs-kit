import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from "@nestjs/common";
import { type CommonErrorObject } from "../util/payloads.util.js";
import { AccessDeniedError } from "./access-denied.error.js";
import type { FastifyReply } from "fastify";

@Catch(AccessDeniedError)
export abstract class AccessDeniedExceptionFilter implements ExceptionFilter<AccessDeniedError> {
    #logger = new Logger(this.constructor.name);

    catch(exception: AccessDeniedError, host: ArgumentsHost) {
        const contextType = host.getType();

        this.#logger.debug(`Access denied (${contextType})`, exception);

        const errorObj: CommonErrorObject = {
            details: { status: 403 },
            message: exception.message,
            code: "ACCESS_DENIED",
        };

        switch (contextType) {
            case "http": {
                const http = host.switchToHttp();
                const res = http.getResponse<FastifyReply>();
                res.status(403).send(errorObj);
                break;
            }
            case "rpc":
            case "ws":
            default:
                return errorObj;
        }
    }
}
