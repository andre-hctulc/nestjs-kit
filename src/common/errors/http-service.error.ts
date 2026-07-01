import { HttpException } from "@nestjs/common";
import type { ErrorShape } from "./error-shape.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "./service-error.types.js";
import { mergeOptions, mergeTags } from "./service-error.util.js";

export class HttpServiceError extends HttpException implements ErrorShape {
    static opts = mergeOptions;

    readonly code: string;
    readonly details: ServiceErrorDetails;

    constructor(message: string, statusCode: number, options: ServiceErrorOptions = {}) {
        const code = options.code || "HOST_ERROR";
        const details: ServiceErrorDetails = {
            ...options.details,
            httpStatusCode: statusCode,
            tags: mergeTags(options),
        };
        super(
            {
                message,
                code,
                details,
            },
            statusCode,
            { cause: options.cause },
        );
        this.code = code;
        this.details = details;
    }
}
