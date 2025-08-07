import { MultipartFile } from "@fastify/multipart";
import { createParamDecorator, ExecutionContext, UnsupportedMediaTypeException } from "@nestjs/common";
import type { BusboyConfig } from "busboy";
import { FastifyRequest } from "fastify";

/**
 * {@link FilePart} decorator with options.
 *
 * Extracts a {@link MultipartFile} or null (not a multipart request) from the request.
 * Use `required: true` to throw an exception if no file is found.
 */
export const FilePartOpts = (options: Omit<BusboyConfig, "headers"> & { required?: boolean }) => {
    return createParamDecorator(async (_data: any, ctx: ExecutionContext): Promise<null | MultipartFile> => {
        const req: FastifyRequest = ctx.switchToHttp().getRequest();

        if (!req.isMultipart()) {
            if (options.required) {
                throw new UnsupportedMediaTypeException();
            }
            return null;
        }

        const file = await req.file(options);

        if (options.required && !file) {
            throw new UnsupportedMediaTypeException();
        }

        return file || null;
    });
};

/**
 * **@fastify/multipart** file part decorator.
 *
 * Retrieves the first file uploaded in the request with a multipart form.
 */
export const FilePart = FilePartOpts({});
