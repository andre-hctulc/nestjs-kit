export interface AccessDeniedErrorOptions extends ErrorOptions {
    missingPermissions?: string[];
}

export class AccessDeniedError extends Error {
    constructor(message?: string, options?: AccessDeniedErrorOptions) {
        super(message || "Access denied", options);
    }
}
