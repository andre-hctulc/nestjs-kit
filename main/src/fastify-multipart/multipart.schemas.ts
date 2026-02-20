import type { MultipartFile } from "@fastify/multipart";
import { z, ZodType } from "zod";
import type { ReadMultipartFile } from "./file-parts.decorators.js";

/**
 * Validates fastify multipart files
 *
 * The part is read in multipart context, otherwise it's up to the user when to read the file.
 */
export const ZodMultipartFile: ZodType<MultipartFile | ReadMultipartFile> = z.looseObject({
    filename: z.string(),
    size: z.number(),
    mimetype: z.string(),
    encoding: z.string(),
    buff: z.custom((v) => Buffer.isBuffer(v), { message: "Not binary" }),
}) as any;
