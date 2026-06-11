export interface ServiceErrorShape {
    code: string;
    details: any;
    message: string;
    cause: unknown;
}
