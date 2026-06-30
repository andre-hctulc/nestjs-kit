import { WsException } from "@nestjs/websockets";
import type { ErrorShape } from "../common/errors/error-shape.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "../common/index.js";
import { mergeOptions, mergeTags } from "../common/errors/service-error.util.js";

export class WsServiceError extends WsException implements ErrorShape {
    static opts = mergeOptions;

    readonly statusCode: string;
    readonly details: ServiceErrorDetails;
    readonly cause: unknown = undefined;

    constructor(message: string, options: ServiceErrorOptions = {}) {
        const code = options.code || "HOST_ERROR";
        const details: ServiceErrorDetails = {
            ...options.details,
            tags: mergeTags(options),
        };
        super({
            message,
            code,
            details,
        });
        this.statusCode = code;
        this.details = details;
    }
}
