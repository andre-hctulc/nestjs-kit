import type { MultipartFile } from "@fastify/multipart";
import { createParamDecorator, UnsupportedMediaTypeException, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { MultipartDecoratorOptions } from "./multipart-decorator-options.interface.js";

/**
 * Extracts `AsyncIterableIterator<MultipartFile> | null` using `req.files()`.
 */
export const FileParts = (options?: MultipartDecoratorOptions) => {
    return createParamDecorator(
        (_data: any, ctx: ExecutionContext): AsyncIterableIterator<MultipartFile> | null => {
            const req: FastifyRequest = ctx.switchToHttp().getRequest();
            const { required, ...multipartOptions } = options ?? {};
            if (!req.isMultipart()) {
                if (required) {
                    throw new UnsupportedMediaTypeException();
                }
                return null;
            }
            return req.files(multipartOptions);
        },
    )();
};
