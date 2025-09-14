import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { z } from "zod/v4";

interface ZodPipeOptions {
    /**
     * Validate only a field.
     *
     * The pipe will still return the full object.
     */
    field?: string | ((data: unknown) => any);
}

@Injectable()
export class ZodPipe implements PipeTransform {
    private field: ZodPipeOptions["field"];

    constructor(private schema: z.ZodSchema, { field }: ZodPipeOptions = {}) {
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
            throw error;
        }

        return this.field ? value : data;
    }
}
