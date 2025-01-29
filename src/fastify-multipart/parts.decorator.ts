import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { FastifyRequest } from "fastify";

async function toMap(req: FastifyRequest, skipFiles?: boolean): Promise<Record<string, any[]>> {
    const parts = await req.parts();

    const result: Record<string, any> = {};

    for await (const part of parts) {
        if (!result[part.fieldname]) {
            result[part.fieldname] = [];
        }

        if ("value" in part) {
            result[part.fieldname].push(part.value);
        } else {
            if (skipFiles) {
                continue;
            }

            // All files must be read, otherwise the for loop will not fulfill
            if (!result[part.fieldname]) {
                result[part.fieldname] = [];
            }

            const buff = await part.toBuffer();
            // The files must be read (toBuffer() or read part.file stream) otherwise the async iterator will not fulfill!
            result[part.fieldname].push({ ...part, buff, size: buff.length });
        }
    }

    return result;
}

/**
 * **@fastify/multipart** parts decorator.
 *
 * Retrieves all uploaded in the request with a multipart form. Fils are read into memory.
 */
export const Parts = createParamDecorator(
    async (_data: any, ctx: ExecutionContext): Promise<Record<string, any> | null> => {
        const req: FastifyRequest = ctx.switchToHttp().getRequest();

        if (!req.isMultipart()) {
            return null;
        }

        return toMap(req);
    }
);

/**
 * **@fastify/multipart** flat parts decorator.
 *
 * Retrieves all uploaded in the request with a multipart form. Fils are read into memory.
 */
export const FlatParts = createParamDecorator(
    async (_data: any, ctx: ExecutionContext): Promise<Record<string, any> | null> => {
        const req: FastifyRequest = ctx.switchToHttp().getRequest();

        if (!req.isMultipart()) {
            return null;
        }

        let map: any = await toMap(req);

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
