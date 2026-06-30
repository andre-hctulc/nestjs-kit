import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from "@nestjs/common";
import { AccessDeniedError } from "./access-denied.error.js";
import { sendError } from "../errors/errors.util.js";
import type { ErrorShape } from "../errors/error-shape.interface.js";

@Catch(AccessDeniedError)
export class AccessDeniedExceptionFilter implements ExceptionFilter<AccessDeniedError> {
    #logger = new Logger(this.constructor.name);

    async catch(exception: AccessDeniedError, host: ArgumentsHost) {
        const contextType = host.getType();

        this.#logger.debug(`Access denied (${contextType})`, exception);

        const errorObj: ErrorShape = {
            details: {},
            message: exception.message,
            statusCode: "ACCESS_DENIED",
        };

        return await sendError(host, errorObj, exception, { httpStatusCode: 403 });
    }
}
