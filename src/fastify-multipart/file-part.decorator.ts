import { MultipartFile } from "@fastify/multipart";
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { FastifyRequest } from "fastify";

/**
 * **@fastify/multipart** file part decorator.
 *
 * Retrieves the first file uploaded in the request with a multipart form.
 */
export const FilePart = createParamDecorator(
    async (_data: any, ctx: ExecutionContext): Promise<null | MultipartFile> => {
        const req: FastifyRequest = ctx.switchToHttp().getRequest();

        if (!req.isMultipart()) {
            return null;
        }

        const file = await req.file();

        return file;
    }
);
