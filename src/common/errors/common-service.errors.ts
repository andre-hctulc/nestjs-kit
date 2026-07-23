import { ServiceError } from "./service-error.class.js";

export class NotImplementedError extends ServiceError {
    constructor(message?: string) {
        super(message || "Not Implemented", { errorCode: "NOT_IMPLEMENTED", statusCode: 501 });
    }
}

export class ServiceNotReadyError extends ServiceError {
    constructor(serviceName?: string, reason?: string) {
        super(`Service${serviceName ? " " + serviceName : ""} not ready${reason ? ": " + reason : ""}`, {
            errorCode: "SERVICE_NOT_READY",
            statusCode: 503,
        });
    }
}
