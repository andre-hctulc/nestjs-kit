import { createParamDecorator, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ApiAccess } from "../util/api-access.class.js";

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

        return someAccess;
    }

    return ApiAccess.confirm(req.apiAccess, AccessClass || ApiAccess);
});
