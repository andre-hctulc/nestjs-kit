import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { parseFilePart } from "./fastify-multipart.util.js";
import type { BusboyConfig } from "busboy";
import { isPlainObject } from "../common/util/system/system-util.js";
import { flatten } from "./fastify-multipart-system.util.js";

async function toMap(
    req: FastifyRequest,
    options: Omit<BusboyConfig, "headers">
): Promise<Record<string, any>> {
    const parts = await req.parts(options);
    const result: Record<string, any[]> = {};

    for await (const part of parts) {
        if (!result[part.fieldname]) {
            result[part.fieldname] = [];
        }

        if ("value" in part) {
            result[part.fieldname].push(part.value);
        } else {
            // The files must be read (toBuffer() or read part.file stream) otherwise the async iterator will not fulfill!
            result[part.fieldname].push(await parseFilePart(part));
        }
    }

    return flatten(result);
}

/**
 * {@link Parts} decorator with options.
 *
 * Extracts `Record<string, any>`.
 *
 * Use `strict: true` to ensure that only multipart requests are processed, otherwise it will return the body if it is a plain object.
 */
export const PartsOpts = (options: Omit<BusboyConfig, "headers"> & { strict?: boolean }) => {
    return createParamDecorator(
        async (_data: any, ctx: ExecutionContext): Promise<Record<string, any> | null> => {
            const req: FastifyRequest = ctx.switchToHttp().getRequest();

            if (!req.isMultipart()) {
                if (!options.strict && isPlainObject(req.body)) {
                    return req.body;
                }
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
