import type { ZodError } from "zod";

export class ZodPipeError extends TypeError {
    constructor(readonly zodError: ZodError) {
        super("Validation failed");
    }
}
