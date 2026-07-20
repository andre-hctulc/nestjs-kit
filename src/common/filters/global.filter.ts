import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { getErrorLocationDescription, sendError } from "../errors/errors.util.js";
import type { FastifyRequest } from "fastify";
import { ServiceError } from "../errors/service-error.class.js";
import type { ErrorShape } from "../errors/error-shape.interface.js";

export type ErrorMapper = (error: unknown) => ErrorShape | Error | null | void | undefined;

/**
 * Catches all errors and maps them to a {@link ErrorShape}
 */
@Catch()
export class GlobalExceptionFilter<T> implements ExceptionFilter {
    #logger = new Logger(this.constructor.name);

    async catch(exception: unknown, host: ArgumentsHost) {
        const originalException = exception;
        let error: ErrorShape;
        let unexpected: boolean;

        // ServiceError
        if (ServiceError.isServiceError(exception)) {
            unexpected = false;
            if (exception.details?.private === true) {
                error = {
                    code: exception.code,
                    message: "An unexpected error occurred",
                    details: {},
                };
            } else {
                error = {
                    code: exception.code,
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
            const message = exception.getError();
            error = {
                code: "UNKNOWN",
                message: String(message),
                details: {},
            };
        }
        // HttpException
        else if (exception instanceof HttpException) {
            unexpected = false;

            let message = exception.getResponse();
            if (typeof message === "object") {
                message = String((message as any).message || "");
            }

            error = {
                code: String(exception.getStatus()),
                message: String(message),
                details: {},
            };
        }
        // Generic Error
        else {
            unexpected = true;
            error = {
                code: "UNKNOWN",
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

        return await sendError(host, error, originalException, {
            httpStatusCode: error.details?.httpStatusCode,
        });
    }
}
