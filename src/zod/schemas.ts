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
 * Parses the first single query/form parameter to a string.
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
 * Parses the first query/form parameter to a boolean.
 */
export const ZodBoolSParam = ZodBoolParam.refine((v) => v.length > 0).transform((v) => v[0]);
export type BoolSParam = z.infer<typeof ZodBoolSParam>;

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
 * Parses the first query parameter to a json.
 */
export const ZodJsonSParam = ZodJsonParam.refine((v) => v.length > 0).transform((v) => v[0]);
export type JsonSParam = z.infer<typeof ZodJsonSParam>;

/**
 * Parses common query parameters.
 */
export const ZodCommonQueryParams = z
    .object({
        limit: ZodNumSParam.refine((n) => n >= 0),
        offset: ZodNumSParam.refine((n) => n >= 0),
        skip: ZodNumSParam.refine((n) => n >= 0),
        sort: ZodSParam.or(z.record(z.any())),
        order: ZodSParam,
        cursor: ZodSParam,
    })
    .strip();
export type CommonQueryParams = z.infer<typeof ZodCommonQueryParams>;

/**
 * Validates fastify multipart files
 */
export const ZodMultipartFile = z
    .object({
        name: z.string(),
        size: z.number(),
        type: z.string(),
        encoding: z.string(),
        buff: z.custom((v) => Buffer.isBuffer(v), { message: "Not binary" }),
    })
    .passthrough();
