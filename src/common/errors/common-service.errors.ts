import { ServiceError } from "./service-error.class.js";

export class NotImplementedError extends ServiceError {
    constructor(message?: string) {
        super(message || "Not Implemented", { code: "NOT_IMPLEMENTED", details: { httpStatusCode: 501 } });
    }
}

export class ServiceNotReadyError extends ServiceError {
    constructor(serviceName?: string, reason?: string) {
        super(`Service${serviceName ? " " + serviceName : ""} not ready${reason ? ": " + reason : ""}`, {
            code: "SERVICE_NOT_READY",
        });
    }
}
