import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { readFilePart } from "./fastify-multipart.util.js";
import { BusboyConfig } from "busboy";

async function toMap(
    req: FastifyRequest,
    options: Omit<BusboyConfig, "headers">
): Promise<Record<string, any[]>> {
    const parts = await req.parts(options);
    const result: Record<string, any> = {};

    for await (const part of parts) {
        if (!result[part.fieldname]) {
            result[part.fieldname] = [];
        }

        if ("value" in part) {
            result[part.fieldname].push(part.value);
        } else {
            // All files must be read, otherwise the for loop will not fulfill
            if (!result[part.fieldname]) {
                result[part.fieldname] = [];
            }

            // The files must be read (toBuffer() or read part.file stream) otherwise the async iterator will not fulfill!
            result[part.fieldname].push(await readFilePart(part));
        }
    }

    return result;
}

/**
 * {@link Parts} decorator with options.
 */
export const PartsOpts = (options: Omit<BusboyConfig, "headers">) => {
    return createParamDecorator(
        async (_data: any, ctx: ExecutionContext): Promise<Record<string, any> | null> => {
            const req: FastifyRequest = ctx.switchToHttp().getRequest();

            if (!req.isMultipart()) {
                return null;
            }

            return toMap(req, options);
        }
    );
};

/**
 * **@fastify/multipart** parts decorator.
 *
 * Retrieves all fields uploaded in the request with a multipart form. Files are loaded into memory.
 */
export const Parts = PartsOpts({});

/**
 * {@link FileParts} decorator with options.
 */
export const FlatPartsOpts = (options: Omit<BusboyConfig, "headers">) => {
    return createParamDecorator(
        async (_data: any, ctx: ExecutionContext): Promise<Record<string, any> | null> => {
            const req: FastifyRequest = ctx.switchToHttp().getRequest();

            if (!req.isMultipart()) {
                return null;
            }

            let map: any = await toMap(req, options);

            for (const key in map) {
                if (map[key].length > 0) {
                    map[key] = map[key][0];
                } else {
                    map[key] = undefined;
                }
            }

            return map;
        }
    );
};

/**
 * **@fastify/multipart** flat parts decorator.
 *
 * Retrieves all fields uploaded in the request with a multipart form flattened. Files are loaded into memory.
 */
export const FlatParts = FlatPartsOpts({});
