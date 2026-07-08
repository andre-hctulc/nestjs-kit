export interface ServiceErrorDetails {
    tags?: string[];
    httpStatusCode?: number;
    [key: string]: any;
}

export interface ServiceErrorOptions {
    details?: ServiceErrorDetails;
    code?: string;
    cause?: unknown;
}
