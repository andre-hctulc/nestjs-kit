import { z, ZodArray, ZodNullable, ZodObject, ZodOptional, ZodType } from "zod";

function transformFromString(schema: ZodType, v: unknown) {
    if (typeof v !== "string") {
        return v;
    }

    const type = schema.def.type;

    switch (type) {
        case "string":
            return v;

        case "nullable":
        case "optional":
            return transformFromString((schema as ZodOptional | ZodNullable).unwrap() as ZodType, v);

        case "null":
            if (v === "null" || v === "") {
                return null;
            }
            return v;
        case "never":
        case "void":
            if (v === "") {
                return undefined;
            }
            return v;
        case "undefined":
            if (v === "undefined" || v === "") {
                return undefined;
            }
            return v;
        case "bigint":
        case "int":
        case "number":
            return Number(v);
        case "boolean":
            return v === "true" || v === "1";
        case "date":
            return new Date(v);
        case "tuple":
        case "array":
        case "record":
        case "object":
            return JSON.parse(v);
        // Default: Let original schema handle uncertain cases
        default:
            return v;
    }
}

function getArrayItemType(schema: ZodType): ZodType | null {
    if (schema instanceof ZodObject) {
        return null;
    }

    if (schema instanceof ZodOptional || schema instanceof ZodNullable) {
        return getArrayItemType(schema.unwrap() as ZodType);
    }

    const def = schema.def;

    if ("type" in def && def.type === "array") {
        return (schema as ZodArray).element as ZodType;
    }

    return null;
}

export function zodCoerceQueryParam<Z extends ZodType>(schema: Z): ZodType<z.infer<Z>, z.input<Z> | string> {
    const arrayItemType = getArrayItemType(schema);

    if (arrayItemType) {
        return z
            .transform((v) => {
                if (typeof v === "string") {
                    return [transformFromString(arrayItemType, v)];
                } else if (Array.isArray(v)) {
                    return v.map((item) => transformFromString(arrayItemType, item));
                }
                return v;
            })
            .pipe(schema) as ZodType<z.infer<Z>, z.input<Z> | string>;
    }

    return z.transform((v) => transformFromString(schema, v)).pipe(schema) as ZodType<
        z.infer<Z>,
        z.input<Z> | string
    >;
}

export function zodCoerceQuery<T extends Record<string, ZodType>>(schema: ZodObject<T>): ZodObject<T> {
    const shape = schema.shape;
    if (!shape) {
        throw new Error("Failed to coerce query: Zod schema has no shape");
    }
    const newShape: Record<string, ZodType<any>> = {};
    for (const key of Object.keys(shape)) {
        newShape[key] = zodCoerceQueryParam(shape[key]);
    }
    return z.object(newShape) as ZodObject<T>;
}
