import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorBody, ErrorMapper } from "./exceptions.types.js";

/**
 * Maps an exception to an {@link ErrorBody}.
 *
 * If the exception is an instance of {@link HttpException}, it will be mapped to an {@link ErrorBody} with the status code and message from the exception.
 * Otherwise it will be mapped to a generic internal server error {@link ErrorBody}.
 *
 * @param exception The exception to map.
 * @param mapError Optional function to map the exception to a different error body or error.
 *
 */
export function mapException(exception: unknown, mapError?: ErrorMapper): ErrorBody {
    if (mapError) {
        const mapped = mapError(exception);
        if (mapped) {
            // return mapped error body directly
            if (!(mapped instanceof Error)) {
                return mapped;
            }
            // otherwise update exception with mapped one
            exception = mapped;
        }
    }

    if (exception instanceof HttpException) {
        const status = exception.getStatus();
        const resObj = exception.getResponse();

        const errBody: ErrorBody = {
            status: status,
            message: exception.message,
            details: {},
        };

        if (typeof resObj === "object") {
            const resObjMessage = (resObj as any)["message"];

            if (typeof resObjMessage === "string") {
                errBody.message = resObjMessage;
                delete (resObj as any)["message"];
            }

            errBody.details = resObj;
        }

        return errBody;
    } else {
        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: "Internal server error",
            details: {},
        };
    }
}
