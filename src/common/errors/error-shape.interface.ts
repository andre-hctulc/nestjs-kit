export interface ErrorShape {
    errorCode: string;
    statusCode: number;
    message: string;
    details?: Record<string, unknown>;
}
