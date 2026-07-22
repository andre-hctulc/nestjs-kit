export interface ServiceErrorDetails {
    tags?: string[];
    httpStatusCode?: number;
    rpcStatusCode?: number;
    private?: boolean;
    [key: string]: any;
}

export interface ServiceErrorOptions {
    details?: ServiceErrorDetails;
    code?: string;
    cause?: unknown;
}
