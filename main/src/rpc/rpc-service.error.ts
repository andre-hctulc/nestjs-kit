import { RpcException } from "@nestjs/microservices";

interface RpcServiceErrorDetails {
    tags: string[];
    [key: string]: any;
}

export interface RpcServiceErrorOptions {
    details?: Partial<RpcServiceErrorDetails>;
    code?: string;
    cause?: unknown;
}

export class RpcServiceError extends RpcException {
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

    constructor(message: string, options: RpcServiceErrorOptions = {}) {
        const code = options.code || "HOST_ERROR";
        super({
            message: `${message} (${code})`,
            code,
            details: options.details,
        });
        this.code = code;
    }
}
