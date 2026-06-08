import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from "@nestjs/common";
import { type CommonErrorObject } from "../util/payloads.util.js";
import { AccessDeniedError } from "./access-denied.error.js";
import { sendError } from "../util/send-error.util.js";

@Catch(AccessDeniedError)
export class AccessDeniedExceptionFilter implements ExceptionFilter<AccessDeniedError> {
    #logger = new Logger(this.constructor.name);

    async catch(exception: AccessDeniedError, host: ArgumentsHost) {
        const contextType = host.getType();

        this.#logger.debug(`Access denied (${contextType})`, exception);

        const errorObj: CommonErrorObject = {
            details: { status: 403 },
            message: exception.message,
            code: "ACCESS_DENIED",
        };

        return await sendError(host, errorObj, exception);
    }
}
