import { HttpException, HttpStatus } from "@nestjs/common";
import type { ErrorBody } from "./http-exceptions.filter.js";

/**
 * Maps an exception to an {@link ErrorBody}.
 */
export function mapException(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
        const status = exception.getStatus();
        const resObj = exception.getResponse();

        const errBody: ErrorBody = {
            statusCode: status,
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
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: "Internal server error",
            details: {},
        };
    }
}
