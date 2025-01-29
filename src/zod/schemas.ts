import { z } from "zod";

/**
 * Parses a query/form parameter to a string array.
 */
export const ZodParam = z
    .string()
    .transform((v) => (v === undefined ? [] : [v]))
    .or(z.array(z.string()));
export type Param = z.infer<typeof ZodParam>;

/**
 * Parses a query/form parameter to a number array.
 */
export const ZodNumParam = ZodParam.transform((v) =>
    v.map((item) => {
        const num = Number(item);
        if (isNaN(num)) {
            throw new Error("Not not a number");
        }
        return num;
    })
)
    .or(z.array(z.number()))
    .or(z.number().transform((v) => [v]));
export type NumParam = z.infer<typeof ZodNumParam>;

/**
 * Parses a query/form parameter to a boolean array.
 */
export const ZodBoolParam = ZodParam.transform((v) =>
    v.map((item) => {
        return item === "true" || item === "True" || item === "TRUE";
    })
)
    .or(z.array(z.boolean()))
    .or(z.boolean().transform((v) => [v]));
export type BoolParam = z.infer<typeof ZodBoolParam>;

/**
 * Parses a query parameter to a json array.
 */
export const ZodJsonParam = ZodParam.transform((v) =>
    v.map<any>((item) => {
        try {
            return JSON.parse(item);
        } catch (e) {
            throw new Error("Invalid JSON", { cause: e });
        }
    })
);
export type JsonParam = z.infer<typeof ZodJsonParam>;

/**
 * Parses common query parameters.
 */
export const ZodCommonQueryParams = z
    .object({
        limit: ZodNumParam.refine((arr) => arr.length > 0)
            .transform(([num]) => num)
            .refine((n) => n >= 0),
        offset: ZodNumParam.refine((arr) => arr.length > 0)
            .transform(([num]) => num)
            .refine((n) => n >= 0),
        skip: ZodNumParam.refine((arr) => arr.length > 0)
            .transform(([num]) => num)
            .refine((n) => n >= 0),
        sort: ZodParam.refine((arr) => arr.length > 0)
            .transform(([str]) => str)
            .or(z.record(z.any())),
        order: ZodParam.refine((arr) => arr.length > 0).transform(([str]) => str),
        cursor: ZodParam.refine((arr) => arr.length > 0).transform(([str]) => str),
    })
    .strip();
export type CommonQueryParams = z.infer<typeof ZodCommonQueryParams>;
