import { HttpException } from "@nestjs/common";

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

export class HttpServiceError extends HttpException {
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

    constructor(message: string, status: number, options: HttpServiceErrorOptions = {}) {
        const code = options.code || "HOST_ERROR";
        super(
            {
                message: `${message} (${code})`,
                code,
                details: options.details,
            },
            status,
            { cause: options.cause, description: options.description },
        );
        this.code = code;
    }
}
