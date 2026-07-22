import { RpcException } from "@nestjs/microservices";
import type { ErrorShape } from "../common/errors/error-shape.interface.js";
import type { ServiceErrorDetails, ServiceErrorOptions } from "../common/index.js";
import { mergeOptions, mergeTags } from "../common/errors/service-error.util.js";

export class ConnectRpcServiceError extends RpcException implements ErrorShape {
    static opts = mergeOptions;

    readonly code: string;
    readonly details: ServiceErrorDetails;
    readonly cause: unknown = undefined;
    readonly rpcStatusCode: number;

    constructor(message: string, statusCode?: number, options: ServiceErrorOptions = {}) {
        const code = options.code || "CONNECT_SERVICE_ERROR";
        const rpcStatusCode = statusCode ?? 2;
        const details: ServiceErrorDetails = {
            ...options.details,
            rpcStatusCode,
            tags: mergeTags(options),
        };
        super({
            message,
            code,
            details,
        });
        this.rpcStatusCode = rpcStatusCode;
        this.code = code;
        this.details = details;
        this.cause = options.cause;
    }
}
