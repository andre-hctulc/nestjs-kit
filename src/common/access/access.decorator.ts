import { createParamDecorator } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ApiAccess } from "./api-access.class.js";
import type { ApiAccessConstructor } from "./access.types.js";

/**
 * Decorator to confirm api access
 * @param AccessClass `ApiAccess` classes to confirm against
 */
export const Access = createParamDecorator<
    ApiAccessConstructor | ApiAccessConstructor[] | undefined,
    ApiAccess
>((AccessClass, ctx) => {
    const http = ctx.switchToHttp();
    const req: FastifyRequest = http.getRequest();
    const access = req.apiAccess;

    return ApiAccess.confirm(access, AccessClass || ApiAccess);
});
