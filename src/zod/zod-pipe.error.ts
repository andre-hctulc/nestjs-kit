import type { ZodError } from "zod";

export class ZPipeError extends TypeError {
    constructor(readonly zodError: ZodError) {
        super("Validation failed");
    }
}
