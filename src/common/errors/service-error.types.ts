export interface ServiceErrorDetails {
    tags?: string[];
    private?: boolean;
    [key: string]: any;
}

export interface ServiceErrorOptions {
    details?: ServiceErrorDetails;
    errorCode?: string;
    statusCode?: number;
    cause?: unknown;
}
