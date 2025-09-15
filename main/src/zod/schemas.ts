import { z } from "zod";

/**
 * Parses a query/form parameter to a string array.
 */
export const ZodParam = z
    .string()
    .transform((v) => [v])
    .or(z.array(z.string()));
export type Param = z.infer<typeof ZodParam>;

/**
 * Parses the first query/form parameter to a string.
 */
export const ZodSParam = ZodParam.refine((v) => v.length > 0).transform((v) => v[0]);
export type SParam = z.infer<typeof ZodSParam>;

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
 * Parses the first query/form parameter to a number.
 */
export const ZodNumSParam = ZodNumParam.refine((v) => v.length > 0).transform((v) => v[0]);
export type NumSParam = z.infer<typeof ZodNumSParam>;

/**
 * Parses a query/form parameter to a boolean array.
 *
 * "true" and "on" (case insensitive) are considered true, everything else is false.
 */
export const ZodBoolParam = ZodParam.transform((v) =>
    v.map((item) => {
        const lower = item?.toLowerCase();

        return (
            lower === "true" ||
            // enhanced html checkbox compatibility
            lower === "on"
        );
    })
)
    .or(z.array(z.boolean()))
    .or(z.boolean().transform((v) => [v]));
export type BoolParam = z.infer<typeof ZodBoolParam>;

/**
 * Parses the first query/form parameter to a boolean.
 */
export const ZodBoolSParam = ZodBoolParam.refine((v) => v.length > 0).transform((v) => v[0]);
export type BoolSParam = z.infer<typeof ZodBoolSParam>;

/**
 * Parses a query parameter as json.
 */
export const ZodJSONParam = ZodParam.transform((v) =>
    v.map<any>((item) => {
        return JSON.parse(item);
    })
);
export type JSONParam = z.infer<typeof ZodJSONParam>;

/**
 * Parses the first query parameter as json.
 */
export const ZodJSONSParam = ZodJSONParam.refine((v) => v.length > 0).transform((v) => v[0]);
export type JSONSParam = z.infer<typeof ZodJSONSParam>;

/**
 * Parses common query parameters.
 */
export const ZodCommonQueryParams = z.object({
    limit: ZodNumSParam.refine((n) => n >= 0),
    offset: ZodNumSParam.refine((n) => n >= 0),
    skip: ZodNumSParam.refine((n) => n >= 0),
    sort: ZodSParam.or(z.record(z.string(), z.any())),
    order: ZodSParam,
    cursor: ZodSParam,
    page: ZodNumSParam.refine((n) => n >= 0),
    page_size: ZodNumSParam.refine((n) => n >= 0),
    page_tag: ZodParam,
});
export type CommonQueryParams = z.infer<typeof ZodCommonQueryParams>;
