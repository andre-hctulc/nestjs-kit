import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import z from "zod";
import { ZodQueryParam } from "./schemas.js";

@Injectable()
export class ZodPipe implements PipeTransform {
    constructor(private schema: z.ZodSchema) {}

    transform(value: any, metadata: ArgumentMetadata) {
        const result = this.schema.safeParse(value);

        if (!result.success) {
            throw new BadRequestException(`Param validation failed: ${result.error.message}`, {
                // TODO check this in ExceptionsFilter and add set as detail or message? or is result.error.message enough?
                cause: result.error,
            });
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
        let schema: z.ZodSchema = ZodQueryParam;

        if (minLength !== undefined || maxLength !== undefined) {
            schema = schema.refine((v) => {
                if (minLength && v.length < minLength) {
                    return false;
                }
                if (maxLength && v.length > maxLength) {
                    return false;
                }
                return true;
            });
        }

        if (optional) {
            schema = schema.optional() as any;
        }

        super(schema);
    }
}
