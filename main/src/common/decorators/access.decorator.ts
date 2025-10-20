import { createParamDecorator } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { APIAccess } from "../util/api-access.class.js";

type APIAccessConstructor = abstract new (...args: any) => APIAccess;

// TODO support different context
/**
 * Decorator to confirm API access. Checks `req.apiAccess` against the provided `AccessClass`.
 * @param AccessClass - The class to confirm the API access against. If not provided, the base APIAccess class is used.
 */
export const Access = createParamDecorator<APIAccessConstructor, APIAccess>((AccessClass, ctx) => {
    const http = ctx.switchToHttp();
    const req: FastifyRequest = http.getRequest();
    return APIAccess.confirm(req.apiAccess, AccessClass || APIAccess);
});
