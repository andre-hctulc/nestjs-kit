import { Multipart } from "@fastify/multipart";
import { ReadMultipartFile } from "./file-parts.decorators.js";

export async function readFilePart(part: Multipart): Promise<ReadMultipartFile> {
    const buff = await part.toBuffer();
    // The files must be read (toBuffer() or read part.file stream) otherwise the async iterator will not fulfill!
    return { ...part, buff, size: buff.length };
}

export function flatten(obj: Record<string, any>) {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => {
            if (Array.isArray(value) && value.length === 1) {
                return [key, value[0]];
            }
            return [key, value];
        })
    );
}
