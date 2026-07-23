import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { getErrorLocationDescription, sendError } from "../errors/errors.util.js";
import { ServiceError } from "../errors/service-error.class.js";
import type { ErrorShape } from "../errors/error-shape.interface.js";

export type ErrorMapper = (error: unknown) => ErrorShape | Error | null | void | undefined;

/**
 * Catches all errors and maps them to an {@link ErrorShape}
 */
@Catch()
export class GlobalExceptionFilter<T> implements ExceptionFilter {
    #logger = new Logger(this.constructor.name);

    async catch(exception: unknown, host: ArgumentsHost) {
        let error: ErrorShape;
        let unexpected: boolean;

        // ServiceError
        if (ServiceError.isServiceError(exception)) {
            unexpected = false;
            if (exception.details?.private === true) {
                error = {
                    statusCode: exception.statusCode,
                    errorCode: exception.errorCode,
                    message: "An unexpected error occurred",
                    details: {},
                };
            } else {
                error = {
                    errorCode: exception.errorCode,
                    statusCode: exception.statusCode,
                    message: exception.message,
                    details: exception.details,
                };
            }
        }
        // WsException/RpcException
        else if (
            exception instanceof Error &&
            "getError" in exception &&
            typeof exception.getError === "function"
        ) {
            unexpected = false;

            let message: any = exception.getError();
            if (message && typeof message === "object") {
                message = String(message.message || "");
            }

            error = {
                errorCode: "TRANSPORT_EXCEPTION",
                statusCode: 500,
                message: String(message),
                details: {},
            };
        }
        // HttpException
        else if (exception instanceof HttpException) {
            unexpected = false;

            let message: any = exception.getResponse();
            if (message && typeof message === "object") {
                message = String(message.message || "");
            }

            error = {
                errorCode: "HTTP_EXCEPTION",
                statusCode: exception.getStatus(),
                message: String(message),
                details: {},
            };
        }
        // Generic Error
        else {
            unexpected = true;
            error = {
                errorCode: "UNKNOWN",
                statusCode: 500,
                message: "An unexpected error occurred",
                details: {},
            };
        }

        const at = getErrorLocationDescription(host);
        if (unexpected) {
            this.#logger.error(`Unexpected error at ${at}`, exception);
        } else {
            this.#logger.debug(`Error at ${at}:`, exception);
        }

        return await sendError(host, error, error.statusCode);
    }
}
