import { RpcException } from "@nestjs/microservices";
import type { ErrorShape } from "../common/errors/error-shape.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "../common/index.js";
import { mergeOptions, mergeTags } from "../common/errors/service-error.util.js";
import { Code } from "@connectrpc/connect";

export class ConnectServiceError extends RpcException implements ErrorShape {
    static opts = mergeOptions;

    readonly errorCode: string;
    readonly statusCode: number;

    readonly details: ServiceErrorDetails;

    readonly cause: unknown;

    constructor(message: string, options: ServiceErrorOptions = {}) {
        const errorCode = options.errorCode || "CONNECT_SERVICE_ERROR";
        // grpc error
        const statusCode = options.statusCode ?? Code.Internal;

        const details: ServiceErrorDetails = {
            ...options.details,
            errorCode,
            statusCode,
            tags: mergeTags({ details: { tags: ["connect_service"] } }, options),
        };

        super({
            message,
            errorCode,
            statusCode,
            details,
            // add rpc status code as code for connect/grpc compatibility
            code: statusCode,
        });

        this.errorCode = errorCode;
        this.statusCode = statusCode;
        this.details = details;
    }
}
