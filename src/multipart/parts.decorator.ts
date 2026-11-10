import { createParamDecorator, UnsupportedMediaTypeException, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { MultipartDecoratorOptions } from "./multipart-decorator-options.interface.js";
import type { Multipart, MultipartFile } from "@fastify/multipart";

/**
 * Extracts `AsyncIterableIterator<Multipart> | null` using `req.files()`.
 */
export const Parts = (options: MultipartDecoratorOptions) => {
    return createParamDecorator(
        (_data: any, ctx: ExecutionContext): AsyncIterableIterator<Multipart> | null => {
            const req: FastifyRequest = ctx.switchToHttp().getRequest();
            const { required, ...multipartOptions } = options;

            if (!req.isMultipart()) {
                if (required) {
                    throw new UnsupportedMediaTypeException();
                }
                return null;
            }

            return req.parts(multipartOptions);
        },
    );
};
