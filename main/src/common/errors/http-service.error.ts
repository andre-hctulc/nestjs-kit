import { HttpException } from "@nestjs/common";
import type { ServiceError } from "./service-error.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "./service-error.types.js";
import { mergeOptions } from "./service-error.util.js";

export class HttpServiceError extends HttpException implements ServiceError {
    static opts = mergeOptions;

    readonly code: string;
    readonly details: ServiceErrorDetails;

    constructor(message: string, status: number, options: ServiceErrorOptions = {}) {
        const code = options.code || "HOST_ERROR";
        const details: ServiceErrorDetails = {
            tags: [],
            ...options.details,
        };
        super(
            {
                message,
                code,
                details,
            },
            status,
            { cause: options.cause },
        );
        this.code = code;
        this.details = details;
    }
}
