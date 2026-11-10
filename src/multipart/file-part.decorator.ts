import type { MultipartFile } from "@fastify/multipart";
import { createParamDecorator, type ExecutionContext, UnsupportedMediaTypeException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { MultipartDecoratorOptions } from "./multipart-decorator-options.interface.js";

/**
 * Extracts `MultipartFile | null` using `req.file()`.
 */
export const FilePart = (options: MultipartDecoratorOptions) => {
    return createParamDecorator(async (_data: any, ctx: ExecutionContext): Promise<MultipartFile | null> => {
        const req: FastifyRequest = ctx.switchToHttp().getRequest();
        const { required, ...multipartOptions } = options;

        if (!req.isMultipart()) {
            if (required) {
                throw new UnsupportedMediaTypeException();
            }
            return null;
        }

        const file = await req.file(multipartOptions);

        if (required && !file) {
            throw new UnsupportedMediaTypeException();
        }

        return file || null;
    });
};
