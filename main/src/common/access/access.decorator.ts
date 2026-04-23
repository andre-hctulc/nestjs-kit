import { createParamDecorator, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ApiAccess } from "./api-access.class.js";
import { AccessDeniedError } from "./access-denied.error.js";

export type ApiAccessConstructor = abstract new (...args: any) => ApiAccess;

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

    if (Array.isArray(AccessClass)) {
        let someAccess: ApiAccess | null = null;

        for (const Access of AccessClass) {
            try {
                const confirmedAccess = ApiAccess.confirm(access, Access);
                if (confirmedAccess) {
                    someAccess = confirmedAccess;
                    break;
                }
            } catch (e) {}
        }

        if (!someAccess) {
            throw new UnauthorizedException();
        }

        if (someAccess.revoked) {
            throw new AccessDeniedError();
        }

        return someAccess;
    }

    if (access?.revoked) {
        throw new AccessDeniedError();
    }

    return ApiAccess.confirm(access, AccessClass || ApiAccess);
});
