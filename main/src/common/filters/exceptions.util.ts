import { HttpException, HttpStatus } from "@nestjs/common";
import { CommonErrorObject, ErrorMapper } from "./exceptions.types.js";

export function objectErrorObject(obj: object | string): CommonErrorObject {
    if (typeof obj === "string") {
        return {
            message: obj,
            code: 500,
            details: {},
        };
    }

    obj = { ...obj };
    let message: string = "Internal Server Error";
    let code: string | number = 500;
    let details: any;

    if ("message" in obj && typeof obj.message === "string") {
        message = obj.message;
        delete obj.message;
    }

    if ("code" in obj && (typeof obj.code === "number" || typeof obj.code === "string")) {
        code = obj.code;
        delete obj.code;
    }

    if ("details" in obj) {
        details = obj.details;
        delete obj.details;
    }

    return {
        message,
        code,
        details: details ? { ...details, extra: obj } : obj,
    };
}

/**
 * Maps an exception to a {@link CommonErrorObject}.
 *
 * If the exception is an instance of {@link HttpException}, it is mapped to an {@link CommonErrorObject} with the status code and message of the exception.
 * Otherwise it will be mapped to a generic internal server error {@link CommonErrorObject}.
 *
 * @param exception The exception to map.
 * @param mapError Optional function to map the exception to a different error body or error.
 *
 */
export function mapHttpException(exception: unknown, mapError?: ErrorMapper): CommonErrorObject {
    let userMapped = false;

    if (mapError) {
        const mapped = mapError(exception);
        if (mapped) {
            // return mapped error body directly
            if (!(mapped instanceof Error)) {
                return mapped;
            }
            // otherwise update exception with mapped one
            exception = mapped;
            userMapped = true;
        }
    }

    if (exception instanceof HttpException) {
        const status = exception.getStatus();
        const resObj = exception.getResponse();
        const errObj = objectErrorObject(resObj);
        if (status) {
            errObj.code = status;
        }
        return errObj;
    } else {
        return {
            code: HttpStatus.INTERNAL_SERVER_ERROR,
            message: "Internal server error",
            details: {},
        };
    }
}
