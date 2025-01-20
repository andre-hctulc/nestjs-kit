import { MultipartFile } from "@fastify/multipart";
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { FastifyRequest } from "fastify";

export type ReadMultipartFile = MultipartFile & { buff: Buffer; size: number };

async function toMap(req: FastifyRequest): Promise<Record<string, ReadMultipartFile[]>> {
    const parts = await req.files();
    const map: Record<string, ReadMultipartFile[]> = {};

    for await (const part of parts) {
        if (!map[part.fieldname]) {
            map[part.fieldname] = [];
        }

        if ("value" in part) {
        } else {
            // All files must be read, otherwise the for loop will not fulfill
            if (!map[part.fieldname]) {
                map[part.fieldname] = [];
            }

            const buff = await part.toBuffer();
            // The files must be read (toBuffer() or read part.file stream) otherwise the async iterator will not fulfill!
            map[part.fieldname].push({ ...part, buff, size: buff.length });
        }
    }

    return map;
}

/**
 * **@fastify/multipart** file parts decorator.
 *
 * Retrieves files uploaded in the request with a multipart form. The files are read and set in the field `buff`.
 */
export const FileParts = createParamDecorator(
    async (_data: any, ctx: ExecutionContext): Promise<null | Record<string, ReadMultipartFile[]>> => {
        const req: FastifyRequest = ctx.switchToHttp().getRequest();

        if (!req.isMultipart()) {
            return null;
        }

        return toMap(req);
    }
);


/**
 * **@fastify/multipart** flat file parts decorator.
 *
 * Retrieves files uploaded in the request with a multipart form. The files are read and set in the field `buff`.
 */
export const FlatFileParts = createParamDecorator(
    async (
        _data: any,
        ctx: ExecutionContext
    ): Promise<null | Record<string, MultipartFile & { buff: Buffer }>> => {
        const req: FastifyRequest = ctx.switchToHttp().getRequest();

        if (!req.isMultipart()) {
            return null;
        }

        const map: any = await toMap(req);

        for (const key in map) {
            if (map[key].length > 0) {
                map[key] = map[key][0];
            } else {
                delete map[key];
            }
        }

        return map;
    }
);
