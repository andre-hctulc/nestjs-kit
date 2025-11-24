import { createParamDecorator, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { APIAccess } from "../util/api-access.class.js";

export type APIAccessConstructor = abstract new (...args: any) => APIAccess;

/**
 * Decorator to confirm API access. Checks `req.apiAccess` against the provided `AccessClass`.
 * @param AccessClass `ApiAccess` classes to confirm against. If multiple classes are provided, access is granted if any match. Defaults to `APIAccess`.
 */
export const Access = createParamDecorator<
    APIAccessConstructor | APIAccessConstructor[] | undefined,
    APIAccess
>((AccessClass, ctx) => {
    const http = ctx.switchToHttp();
    const req: FastifyRequest = http.getRequest();
    const access = req.apiAccess;

    if (Array.isArray(AccessClass)) {
        let someAccess: APIAccess | null = null;

        for (const Access of AccessClass) {
            try {
                const confirmedAccess = APIAccess.confirm(access, Access);
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

    return APIAccess.confirm(req.apiAccess, AccessClass || APIAccess);
});
