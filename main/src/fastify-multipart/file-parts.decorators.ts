import { MultipartFile } from "@fastify/multipart";
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { readFilePart } from "./fastify-multipart.util.js";
import { BusboyConfig } from "busboy";

export type ReadMultipartFile = MultipartFile & { buff: Buffer; size: number };

async function toMap(
    req: FastifyRequest,
    options: Omit<BusboyConfig, "headers">
): Promise<Record<string, ReadMultipartFile[]>> {
    const parts = await req.files(options);
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

            // The files must be read (toBuffer() or read part.file stream) otherwise the async iterator will not fulfill!
            map[part.fieldname].push(await readFilePart(part));
        }
    }

    return map;
}

/**
 * {@link FileParts} decorator with options.
 */
export const FilePartsOpts = (options: Omit<BusboyConfig, "headers">) => {
    return createParamDecorator(
        async (_data: any, ctx: ExecutionContext): Promise<null | Record<string, ReadMultipartFile[]>> => {
            const req: FastifyRequest = ctx.switchToHttp().getRequest();

            if (!req.isMultipart()) {
                return null;
            }

            return toMap(req, options);
        }
    );
};

/**
 * **@fastify/multipart** file parts decorator.
 *
 * Retrieves files uploaded in the request with a multipart form. The files are read and set in the field `buff`.
 */
export const FileParts = FilePartsOpts({});

/**
 * {@link FlatFileParts} decorator with options.
 */
export const FlatFilePartsOpts = (options: Omit<BusboyConfig, "headers">) => {
    return createParamDecorator(
        async (
            _data: any,
            ctx: ExecutionContext
        ): Promise<null | Record<string, MultipartFile & { buff: Buffer }>> => {
            const req: FastifyRequest = ctx.switchToHttp().getRequest();

            if (!req.isMultipart()) {
                return null;
            }

            const map: any = await toMap(req, options);

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
};

/**
 * **@fastify/multipart** flat file parts decorator.
 *
 * Retrieves files uploaded in the request with a multipart form. The files are read and set in the field `buff`.
 */
export const FlatFileParts = FlatFilePartsOpts({});
