import { HttpException } from "@nestjs/common";
import type { ServiceError } from "./service-error.interface.js";

interface HttpServiceErrorDetails {
    tags: string[];
    [key: string]: any;
}

export interface HttpServiceErrorOptions {
    details?: Partial<HttpServiceErrorDetails>;
    code?: string;
    cause?: unknown;
    description?: string;
}

export class HttpServiceError extends HttpException implements ServiceError {
    static opts(
        options1?: HttpServiceErrorOptions,
        options2?: HttpServiceErrorOptions,
    ): HttpServiceErrorOptions {
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
    readonly details: HttpServiceErrorDetails;

    constructor(message: string, status: number, options: HttpServiceErrorOptions = {}) {
        const code = options.code || "HOST_ERROR";
        const details: HttpServiceErrorDetails = {
            tags: [],
            ...options.details,
        };
        super(
            {
                message: `${message} (${code})`,
                code,
                details,
            },
            status,
            { cause: options.cause, description: options.description },
        );
        this.code = code;
        this.details = details;
    }
}
