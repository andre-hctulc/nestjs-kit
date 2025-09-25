import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorBody, ErrorMapper } from "./exceptions.types.js";

/**
 * Maps an exception to an {@link ErrorBody}.
 *
 * If the exception is an instance of {@link HttpException}, it is mapped to an {@link ErrorBody} with the status code and message of the exception.
 * Otherwise it will be mapped to a generic internal server error {@link ErrorBody}.
 *
 * @param exception The exception to map.
 * @param mapError Optional function to map the exception to a different error body or error.
 *
 */
export function mapException(exception: unknown, mapError?: ErrorMapper): ErrorBody {
    return mapExceptionWithInfo(exception, mapError).body;
}

export function mapExceptionWithInfo(
    exception: unknown,
    mapError?: ErrorMapper
): { body: ErrorBody; userMapped: boolean } {
    let userMapped = false;

    if (mapError) {
        const mapped = mapError(exception);
        if (mapped) {
            // return mapped error body directly
            if (!(mapped instanceof Error)) {
                return { body: mapped, userMapped: true };
            }
            // otherwise update exception with mapped one
            exception = mapped;
            userMapped = true;
        }
    }

    if (exception instanceof HttpException) {
        const status = exception.getStatus();
        const resObj = exception.getResponse();

        const errBody: ErrorBody = {
            code: status,
            message: exception.message,
            details: {},
        };

        if (resObj && typeof resObj === "object") {
            const resObjMessage = (resObj as any)["message"];

            if (typeof resObjMessage === "string") {
                errBody.message = resObjMessage;
                delete (resObj as any)["message"];
            }

            errBody.details = resObj;
        }

        return { body: errBody, userMapped };
    } else {
        return {
            body: {
                code: HttpStatus.INTERNAL_SERVER_ERROR,
                message: "Internal server error",
                details: {},
            },
            userMapped: false,
        };
    }
}
