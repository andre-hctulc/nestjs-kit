import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import z, { ZodObject, ZodSchema } from "zod";
import { CommonQueryParams, ZodBoolParam, ZodCommonQueryParams, ZodNumParam, ZodParam } from "./schemas.js";

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
 * Parses a query/form parameter to a string array.
 */
@Injectable()
export class ZodParamPipe extends ZodPipe {
    constructor({
        optional,
        minLength,
        maxLength,
    }: { optional?: boolean; minLength?: number; maxLength?: number } = {}) {
        let schema: z.ZodSchema = ZodParam;

        if (minLength !== undefined || maxLength !== undefined) {
            schema = schema.refine((v) => {
                if (minLength !== undefined && v.length < minLength) {
                    return false;
                }
                if (maxLength !== undefined && v.length > maxLength) {
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
/**
 * Parses a query/form parameter to a number array.
 */
@Injectable()
export class ZodNumParamPipe extends ZodPipe {
    constructor({
        optional,
        minLength,
        maxLength,
        min,
        max,
    }: { optional?: boolean; minLength?: number; maxLength?: number; min?: number; max?: number } = {}) {
        let schema: z.ZodSchema = ZodNumParam;

        if (maxLength !== undefined || minLength !== undefined) {
            schema = schema.refine((v) => {
                if (minLength !== undefined && v.length < minLength) {
                    return false;
                }
                if (maxLength !== undefined && v.length > maxLength) {
                    return false;
                }
                return true;
            });
        }

        if (min !== undefined || max !== undefined) {
            schema = schema.refine((v: number[]) => {
                if (min !== undefined && v.some((item) => item < min)) {
                    return false;
                }
                if (max !== undefined && v.some((item) => item > max)) {
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

/**
 * Parses a query/form parameter to a boolean array.
 */
export class ZodBoolParamPipe extends ZodPipe {
    constructor({ optional }: { optional?: boolean } = {}) {
        let schema: ZodSchema = ZodBoolParam;
        if (optional) {
            schema = schema.optional();
        }
        super(schema);
    }
}

/**
 * Parses common query/form parameters.
 * Defaults to optional and partial.
 */
@Injectable()
export class ZodCommonQueryParamsPipe extends ZodPipe {
    constructor({
        defaultValue,
        partial,
        optional,
    }: { defaultValue?: Partial<CommonQueryParams>; partial?: boolean; optional?: boolean } = {}) {
        let schema: any = ZodCommonQueryParams;
        if (partial !== false) {
            schema = schema.partial();
        }
        if (defaultValue) {
            schema = schema.transform((value: any) => ({ ...defaultValue, ...value }));
        }
        if (optional !== false) {
            schema = schema.default({});
        }
        super(schema);
    }
}
