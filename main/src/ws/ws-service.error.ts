import { WsException } from "@nestjs/websockets";
import type { ServiceError } from "../common/errors/service-error.interface.js";

interface WsServiceErrorDetails {
    tags: string[];
    [key: string]: any;
}

export interface WsServiceErrorOptions {
    details?: Partial<WsServiceErrorDetails>;
    code?: string;
    cause?: unknown;
}

export class WsServiceError extends WsException implements ServiceError {
    static opts(options1?: WsServiceErrorOptions, options2?: WsServiceErrorOptions): WsServiceErrorOptions {
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
    readonly details: WsServiceErrorDetails;

    constructor(message: string, options: WsServiceErrorOptions = {}) {
        const code = options.code || "HOST_ERROR";
        const details: WsServiceErrorDetails = {
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
