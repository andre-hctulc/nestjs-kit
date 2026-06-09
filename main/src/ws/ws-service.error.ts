import { WsException } from "@nestjs/websockets";
import type { ServiceError } from "../common/errors/service-error.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "../common/index.js";
import { mergeOptions } from "../common/errors/service-error.util.js";

export class WsServiceError extends WsException implements ServiceError {
    static opts = mergeOptions;

    readonly code: string;
    readonly details: ServiceErrorDetails;
    readonly cause: unknown = undefined;

    constructor(message: string, options: ServiceErrorOptions = {}) {
        const code = options.code || "HOST_ERROR";
        const details: ServiceErrorDetails = {
            tags: [],
            ...options.details,
        };
        super({
            message,
            code,
            details,
        });
        this.code = code;
        this.details = details;
    }
}
