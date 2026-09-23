import { ServiceError } from "../errors/service-error.class.js";
import type { ServiceErrorOptions } from "../errors/service-error.types.js";

export class AccessDeniedError extends ServiceError {
    constructor(message?: string, options?: ServiceErrorOptions) {
        super(
            message || "Access denied",
            ServiceError.opts({ errorCode: "ACCESS_DENIED", statusCode: 403 }, options),
        );
    }
}
