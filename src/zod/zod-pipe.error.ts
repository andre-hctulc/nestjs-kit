import type { ZodError } from "zod";
import type { ErrorShape } from "../common/errors/error-shape.interface.js";

export class ZPipeError extends TypeError implements ErrorShape {
    readonly code = "PARAM_VALIDATION_FAILED";
    readonly details: Record<string, unknown>;

    constructor(readonly zodError: ZodError) {
        super("Validation failed");
        this.details = {
            httpStatusCode: 400,
            issues: zodError.issues,
        };
    }
}
