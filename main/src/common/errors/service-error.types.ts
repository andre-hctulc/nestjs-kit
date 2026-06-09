export interface ServiceErrorDetails {
    tags: string[];
    [key: string]: any;
}

export interface ServiceErrorOptions {
    details?: Partial<ServiceErrorDetails>;
    code?: string;
    cause?: unknown;
}
