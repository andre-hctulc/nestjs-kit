import { Catch, Logger, type ArgumentsHost } from "@nestjs/common";
import { sendError } from "./errors.util.js";
import { ServiceError } from "./service-error.class.js";

@Catch()
export class ServiceErrorExceptionFilter {
    #logger = new Logger(ServiceErrorExceptionFilter.name);

    async catch(exception: any, host: ArgumentsHost) {
        const code = typeof exception?.code === "string" ? exception.code : "UNKNOWN_ERROR";
        const message =
            typeof exception?.message === "string" ? exception.message : "An unexpected error occurred";
        const details =
            typeof exception?.details === "object" && exception.details !== null ? exception.details : {};

        if (ServiceError.isServiceError(exception)) {
            this.#logger.debug("Service error", exception);
        } else {
            this.#logger.error("Unexpected error", exception);
        }

        const priv = details?.private === true;

        return await sendError(
            host,
            {
                code,
                message: priv ? "An unexpected error occurred" : message,
                details: priv ? {} : details,
            },
            exception,
            { httpStatusCode: details?.httpStatusCode },
        );
    }
}
