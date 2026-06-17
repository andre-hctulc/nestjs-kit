export interface ServiceErrorDetails {
    tags?: string[];
    httpStatus?: number;
    [key: string]: any;
}

export interface ServiceErrorOptions {
    details?: ServiceErrorDetails;
    code?: string;
    cause?: unknown;
}
