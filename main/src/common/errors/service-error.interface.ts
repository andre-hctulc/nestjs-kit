export interface ServiceError {
    code: string;
    details: any;
    message: string;
    cause: unknown;
}
