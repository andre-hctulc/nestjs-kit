import { WsException } from "@nestjs/websockets";
import type { ServiceErrorShape } from "../common/errors/service-error-shape.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "../common/index.js";
import { mergeOptions, mergeTags } from "../common/errors/service-error.util.js";

export class WsServiceError extends WsException implements ServiceErrorShape {
    static opts = mergeOptions;

    readonly code: string;
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
        this.code = code;
        this.details = details;
    }
}
