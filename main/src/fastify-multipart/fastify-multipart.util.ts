import { Multipart } from "@fastify/multipart";
import { ReadMultipartFile } from "./file-parts.decorators.js";

export async function parseFilePart(part: Multipart): Promise<ReadMultipartFile> {
    const buff = await part.toBuffer();
    // The files must be read (toBuffer() or read part.file stream) otherwise the async iterator will not fulfill!
    return { ...part, buff, size: buff.length };
}

export function isFilePart(part: unknown): part is ReadMultipartFile {
    return Buffer.isBuffer((part as ReadMultipartFile)?.buff);
}
