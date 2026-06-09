import { RpcException } from "@nestjs/microservices";
import type { ServiceError } from "../common/errors/service-error.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "../common/index.js";
import { mergeOptions } from "../common/errors/service-error.util.js";

export class RpcServiceError extends RpcException implements ServiceError {
    static opts = mergeOptions;

    readonly code: string;
    readonly details: ServiceErrorDetails;
    readonly cause: unknown = undefined;

    constructor(message: string, options: ServiceErrorOptions = {}) {
        const code = options.code || "HOST_ERROR";
        const details: ServiceErrorDetails = {
            ...options.details,
            tags: options.details?.tags || [],
        };
        super({
            message,
            code,
            details,
        });
        this.code = code;
        this.details = details;
        this.cause = options.cause;
    }
}
