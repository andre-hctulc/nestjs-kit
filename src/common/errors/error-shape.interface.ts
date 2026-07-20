export interface ErrorShape {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
