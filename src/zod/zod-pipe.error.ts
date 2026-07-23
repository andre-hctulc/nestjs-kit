import type { ZodError } from "zod";
import type { ErrorShape } from "../common/errors/error-shape.interface.js";

export class ZPipeError extends TypeError implements ErrorShape {
    readonly errorCode = "PARAM_VALIDATION_FAILED";
    readonly statusCode = 400;
    readonly details: Record<string, unknown>;

    constructor(readonly zodError: ZodError) {
        super("Validation failed");
        this.details = {
            issues: zodError.issues,
        };
    }
}
