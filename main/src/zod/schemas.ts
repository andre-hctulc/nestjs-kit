import { MultipartFile } from "@fastify/multipart";
import { z, ZodType } from "zod";
import { ReadMultipartFile } from "../fastify-multipart/file-parts.decorators.js";

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
export const ZodJsonParam = ZodParam.transform((v) =>
    v.map<any>((item) => {
        return JSON.parse(item);
    })
);
export type JsonParam = z.infer<typeof ZodJsonParam>;

/**
 * Parses the first query parameter as json.
 */
export const ZodJsonSParam = ZodJsonParam.refine((v) => v.length > 0).transform((v) => v[0]);
export type JsonSParam = z.infer<typeof ZodJsonSParam>;

/**
 * Parses common query parameters.
 */
export const ZodCommonQueryParams = z.object({
    limit: ZodNumSParam.refine((n) => n >= 0),
    offset: ZodNumSParam.refine((n) => n >= 0),
    skip: ZodNumSParam.refine((n) => n >= 0),
    sort: ZodSParam.or(z.record(z.any())),
    order: ZodSParam,
    cursor: ZodSParam,
    page: ZodNumSParam.refine((n) => n >= 0),
    page_size: ZodNumSParam.refine((n) => n >= 0),
    page_tag: ZodParam,
});
export type CommonQueryParams = z.infer<typeof ZodCommonQueryParams>;

/**
 * Validates fastify multipart files
 *
 * The part is read in multipart context, otherwise it's up to the user when to read the file.
 */
export const ZodMultipartFile: ZodType<MultipartFile | ReadMultipartFile> = z
    .object({
        filename: z.string(),
        size: z.number(),
        mimetype: z.string(),
        encoding: z.string(),
        buff: z.custom((v) => Buffer.isBuffer(v), { message: "Not binary" }),
    })
    .passthrough() as any;
