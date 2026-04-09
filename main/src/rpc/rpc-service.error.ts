import { RpcException } from "@nestjs/microservices";
import type { ServiceError } from "../common/errors/service-error.interface.js";

interface RpcServiceErrorDetails {
    tags: string[];
    [key: string]: any;
}

export interface RpcServiceErrorOptions {
    details?: Partial<RpcServiceErrorDetails>;
    code?: string;
    cause?: unknown;
}

export class RpcServiceError extends RpcException implements ServiceError {
    static opts(
        options1?: RpcServiceErrorOptions,
        options2?: RpcServiceErrorOptions,
    ): RpcServiceErrorOptions {
        return {
            details: {
                ...options1?.details,
                ...options2?.details,
                tags: [...(options1?.details?.tags || []), ...(options2?.details?.tags || [])],
            },
            code: options2?.code || options1?.code,
        };
    }
    
    readonly code: string;
    readonly details: RpcServiceErrorDetails;

    constructor(message: string, options: RpcServiceErrorOptions = {}) {
        const code = options.code || "HOST_ERROR";
        const details: RpcServiceErrorDetails = {
            tags: [],
            ...options.details,
        };
        super({
            message: `${message} (${code})`,
            code,
            details,
        });
        this.code = code;
        this.details = details;
    }
}
