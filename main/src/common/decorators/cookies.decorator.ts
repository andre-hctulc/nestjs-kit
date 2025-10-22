import { createParamDecorator } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

/**
 * Decorator to extract cookies from the request.
 * 
 * **Requires a cookie parser middleware to be set up.**
 *
 * @param cookieNames - A single cookie name, an array of cookie names, or undefined to get all cookies.
 * @returns The requested cookie(s) or all cookies.
 */
export const Cookies = createParamDecorator<
    string[] | string | undefined,
    Record<string, string> | string | undefined
>((cookieNames, ctx) => {
    const http = ctx.switchToHttp();
    const req: FastifyRequest = http.getRequest();
    const cookies: any = "cookies" in req ? req.cookies : {};

    if (cookieNames == null) {
        return cookies;
    }

    if (Array.isArray(cookieNames)) {
        const result: Record<string, string> = {};
        for (const name of cookieNames) {
            if (name in cookies) {
                result[name] = cookies[name];
            }
        }
        return result;
    } else {
        return cookies[cookieNames];
    }
});
