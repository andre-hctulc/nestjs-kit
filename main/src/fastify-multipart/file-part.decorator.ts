import { MultipartFile } from "@fastify/multipart";
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { BusboyConfig } from "busboy";
import { FastifyRequest } from "fastify";

/**
 * {@link FilePart} decorator with options.
 */
export const FilePartOpts = (options: Omit<BusboyConfig, "headers">) => {
    return createParamDecorator(async (_data: any, ctx: ExecutionContext): Promise<null | MultipartFile> => {
        const req: FastifyRequest = ctx.switchToHttp().getRequest();

        if (!req.isMultipart()) {
            return null;
        }

        const file = await req.file(options);

        return file;
    });
};

/**
 * **@fastify/multipart** file part decorator.
 *
 * Retrieves the first file uploaded in the request with a multipart form.
 */
export const FilePart = FilePartOpts({});
