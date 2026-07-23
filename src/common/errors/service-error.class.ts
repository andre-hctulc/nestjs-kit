import type { ErrorShape } from "./error-shape.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "./service-error.types.js";
import { mergeOptions, mergeTags } from "./service-error.util.js";

export class ServiceError extends Error implements ErrorShape {
    static opts = mergeOptions;

    readonly errorCode: string;
    readonly statusCode: number;
    readonly details: ServiceErrorDetails;

    constructor(message: string, options: ServiceErrorOptions = {}) {
        const errorCode = options.errorCode || "SERVICE_ERROR";
        const statusCode = options.statusCode ?? 500;

        const details: ServiceErrorDetails = {
            ...options.details,
            errorCode,
            statusCode,
            tags: mergeTags({ details: { tags: ["service"] } }, options),
        };

        super(message, { cause: options.cause });

        this.errorCode = errorCode;
        this.statusCode = statusCode;
        this.details = details;
    }

    static isServiceError(error: unknown): error is ErrorShape & Error {
        return (
            error instanceof Error &&
            typeof (error as any).errorCode === "string" &&
            typeof (error as any).statusCode === "number" &&
            ((typeof (error as any).details === "object" && (error as any).details !== null) ||
                (error as any).details === undefined)
        );
    }
}
