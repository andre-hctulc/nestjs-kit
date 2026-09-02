import { RpcException } from "@nestjs/microservices";
import type { ErrorShape } from "../common/errors/error-shape.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "../common/index.js";
import { mergeOptions, mergeTags } from "../common/errors/service-error.util.js";
import { Code } from "@connectrpc/connect";

export class RabbitMqServiceError extends RpcException implements ErrorShape {
    static opts = mergeOptions;

    readonly errorCode: string;
    readonly statusCode: number;

    readonly details: ServiceErrorDetails;

    override readonly cause: unknown;

    constructor(message: string, options: ServiceErrorOptions = {}) {
        const errorCode = options.errorCode || "RABBIT_SERVICE_ERROR";
        // grpc error
        const statusCode = options.statusCode ?? Code.Internal;

        const details: ServiceErrorDetails = {
            ...options.details,
            errorCode,
            statusCode,
            tags: mergeTags({ details: { tags: ["rabbit_service"] } }, options),
        };

        super({
            message,
            errorCode,
            statusCode,
            details,
        });

        this.errorCode = errorCode;
        this.statusCode = statusCode;
        this.details = details;
    }
}
