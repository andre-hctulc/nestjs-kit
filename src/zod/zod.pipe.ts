import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { z, ZodSchema } from "zod";

@Injectable()
export class ZodPipe implements PipeTransform {
    constructor(private schema: ZodSchema) {}

    transform(value: any, metadata: ArgumentMetadata) {
        const result = this.schema.safeParse(value);

        if (!result.success) {
            throw new BadRequestException("Param validation failed");
        }

        return result.data;
    }
}

/**
 * Parses strings.
 */
@Injectable()
export class ZodStrPipe extends ZodPipe {
    constructor({ optional }: { optional?: boolean } = {}) {
        super(optional ? z.string().optional() : z.string());
    }
}

/**
 * Parses all values to a boolean. 
 * _"true"_ (case insensitive) and _true_ are considered true, everything else is false.
 */
@Injectable()
export class ZodBoolPipe extends ZodPipe {
    constructor({ defaultValue, required }: { defaultValue?: boolean; required?: boolean } = {}) {
        let schema = z
            .any()
            .refine((v) => {
                if (required && v === undefined) {
                    return false;
                }
                return true;
            })
            .transform((v) => v === true || v?.toLowerCase() === "true");

        if (!required) {
            schema = schema.optional() as any;
        }

        schema = schema.or(z.boolean()) as any;

        if (defaultValue) {
            schema = schema.default(false as any) as any;
        }

        super(schema);
    }
}

/**
 * Parses a query parameter to a string array.
 */
@Injectable()
export class ZodQueryParamPipe extends ZodPipe {
    constructor({
        optional,
        minLength,
        maxLength,
    }: { optional?: boolean; minLength?: number; maxLength?: number } = {}) {
        let arrSchema = z.array(z.string());
        let strSchema = z
            .string()
            .optional()
            .transform((v) => [v]);

        if (!optional) {
            strSchema = strSchema.refine((v) => v !== undefined) as any;
        }

        if (minLength !== undefined) {
            arrSchema = arrSchema.min(minLength) as any;
            strSchema.refine((v) => v.length >= minLength);
        }

        if (maxLength !== undefined) {
            arrSchema = arrSchema.max(maxLength) as any;
            strSchema.refine((v) => v.length <= maxLength);
        }

        super(arrSchema.or(strSchema));
    }
}
