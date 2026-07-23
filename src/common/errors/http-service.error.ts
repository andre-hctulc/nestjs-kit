import { HttpException } from "@nestjs/common";
import type { ErrorShape } from "./error-shape.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "./service-error.types.js";
import { mergeOptions, mergeTags } from "./service-error.util.js";

export class HttpServiceError extends HttpException implements ErrorShape {
    static opts = mergeOptions;

    readonly errorCode: string;
    readonly statusCode: number;
    readonly details: ServiceErrorDetails;

    constructor(message: string, options: ServiceErrorOptions = {}) {
        const errorCode = options.errorCode || "HTTP_SERVICE_ERROR";
        const statusCode = options.statusCode ?? 500;

        const details: ServiceErrorDetails = {
            ...options.details,
            errorCode,
            statusCode,
            tags: mergeTags({ details: { tags: ["http_service"] } }, options),
        };

        super(
            {
                message,
                statusCode,
                errorCode,
                details,
            },
            statusCode,
            { cause: options.cause },
        );
        this.errorCode = errorCode;
        this.statusCode = statusCode;
        this.details = details;
    }
}
