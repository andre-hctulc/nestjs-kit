import { type ArgumentMetadata, Injectable, type PipeTransform } from "@nestjs/common";
import { z } from "zod/v4";
import { PipeErrorSymbol } from "./zod-system.util.js";

/* 
Use `ZPipe` as name to prevent conflict with zod's `ZodPipe`.
*/

interface ZPipeOptions {
    /**
     * Validate only a field.
     *
     * The pipe will still return the full object.
     */
    field?: string | ((data: unknown) => any);
}


/**
 * A pipe that validates the input using a zod schema.
 */
@Injectable()
export class ZPipe implements PipeTransform {
    private field: ZPipeOptions["field"];

    constructor(
        private schema: z.ZodSchema,
        { field }: ZPipeOptions = {},
    ) {
        this.field = field ?? "";
    }

    transform(value: any, metadata: ArgumentMetadata) {
        let fieldValue = value;

        if (this.field) {
            if (typeof this.field === "function") {
                fieldValue = this.field(value);
            } else {
                fieldValue = (value as any)?.[this.field];
            }
        }

        const { data, success, error } = this.schema.safeParse(fieldValue);

        if (!success) {
            Object.defineProperty(error, PipeErrorSymbol, {
                value: true,
                enumerable: false,
                writable: false,
            });
            throw error;
        }

        return this.field ? value : data;
    }
}
