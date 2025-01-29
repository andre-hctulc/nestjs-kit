import { z } from "zod";

/**
 * Parses a query parameter to a string array.
 */
export const ZodQueryParam = z
    .string()
    .transform((v) => (v === undefined ? [] : [v]))
    .or(z.array(z.string()));
export type QueryParam = z.infer<typeof ZodQueryParam>;

/**
 * Parses a query parameter to a number array.
 */
export const ZodNumQueryParam = ZodQueryParam.transform((v) =>
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
export type NumQueryParam = z.infer<typeof ZodNumQueryParam>;

/**
 * Parses a query parameter to a boolean array.
 */
export const ZodBoolQueryParam = ZodQueryParam.transform((v) =>
    v.map((item) => {
        return item === "true" || item === "True" || item === "TRUE";
    })
)
    .or(z.array(z.boolean()))
    .or(z.boolean().transform((v) => [v]));
export type BoolQueryParam = z.infer<typeof ZodBoolQueryParam>;

/**
 * Parses a query parameter to a json array.
 */
export const ZodJsonQueryParam = ZodQueryParam.transform((v) =>
    v.map<any>((item) => {
        try {
            return JSON.parse(item);
        } catch (e) {
            throw new Error("Invalid JSON", { cause: e });
        }
    })
);
export type JsonQueryParam = z.infer<typeof ZodJsonQueryParam>;

/**
 * Parses common query parameters.
 */
export const ZodCommonQueryParams = z.object({
    limit: ZodNumQueryParam.refine((arr) => arr.length > 0)
        .transform(([num]) => num)
        .refine((n) => n >= 0),
    offset: ZodNumQueryParam.refine((arr) => arr.length > 0)
        .transform(([num]) => num)
        .refine((n) => n >= 0),
    sort: ZodQueryParam.refine((arr) => arr.length > 0)
        .transform(([str]) => str)
        .or(z.record(z.any())),
    order: ZodQueryParam.refine((arr) => arr.length > 0).transform(([str]) => str),
    cursor: ZodQueryParam.refine((arr) => arr.length > 0).transform(([str]) => str),
});
export type CommonQueryParams = z.infer<typeof ZodCommonQueryParams>;
