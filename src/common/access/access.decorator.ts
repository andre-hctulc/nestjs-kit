import { createParamDecorator, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ApiAccess } from "./api-access.class.js";
import { AccessDeniedError } from "./access-denied.error.js";
import type { ApiAccessConstructor } from "./access.types.js";

/**
 * Decorator to confirm api access. Checks `req.apiAccess` against the provided `AccessClass`.
 * @param AccessClass `ApiAccess` classes to confirm against. If multiple classes are provided, access is granted if any match. Defaults to `APIAccess`.
 */
export const Access = createParamDecorator<
    ApiAccessConstructor | ApiAccessConstructor[] | undefined,
    ApiAccess
>((AccessClass, ctx) => {
    const http = ctx.switchToHttp();
    const req: FastifyRequest = http.getRequest();
    const access = req.apiAccess;

    if (access?.revoked) {
        throw new AccessDeniedError();
    }

    return ApiAccess.confirm(access, AccessClass || ApiAccess);
});
