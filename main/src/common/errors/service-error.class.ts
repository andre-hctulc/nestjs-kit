import type { ServiceErrorShape } from "./service-error-shape.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "./service-error.types.js";
import { mergeOptions, mergeTags } from "./service-error.util.js";

export class ServiceError extends Error implements ServiceErrorShape {
    static opts = mergeOptions;

    readonly code: string;
    readonly details: ServiceErrorDetails;
    readonly cause: unknown;

    constructor(message: string, options: ServiceErrorOptions = {}) {
        const code = options.code || "HOST_ERROR";
        const details: ServiceErrorDetails = {
            ...options.details,
            tags: mergeTags(options),
        };
        super(message, { cause: options.cause });
        this.code = code;
        this.details = details;
        this.cause = options.cause;
    }
}
