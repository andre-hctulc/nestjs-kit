import type { ErrorShape } from "./error-shape.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "./service-error.types.js";
import { mergeOptions, mergeTags } from "./service-error.util.js";

export class ServiceError extends Error implements ErrorShape {
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

    static isServiceError(error: unknown): error is ErrorShape & Error {
        return (
            error instanceof Error &&
            typeof (error as any).code === "string" &&
            ((typeof (error as any).details === "object" && (error as any).details !== null) ||
                (error as any).details === undefined)
        );
    }
}
