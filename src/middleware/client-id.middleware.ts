import { type NestMiddleware } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { parse, serialize, SerializeOptions } from "cookie";
import { randomUUID } from "crypto";

declare module "fastify" {
    interface FastifyRequest {
        /**
         * The client ID cookie value.
         *
         * This is set by the {@link ClientIdMiddleware}.
         */
        clientId?: string;
    }
}

declare module "express" {
    interface Request {
        /**
         * The client ID cookie value.
         *
         * This is set by the {@link ClientIdMiddleware}.
         */
        clientId?: string;
    }
}

/**
 * Ensures that an ID cookie is set for each client.
 * If the cookie is not present, it generates a new UUID and sets it as a cookie.
 *
 * Default cookie options:
 * - httpOnly: true
 * - secure: true
 * - path: /
 *
 * Use {@link ClientIdMiddleware.create} to create a new instance of the middleware with custom options.
 *
 * @param cookieName - The name of the cookie to set.
 * @param cookieOptions - Additional options for the cookie.
 */
export abstract class ClientIdMiddleware implements NestMiddleware {
    /**
     * Middleware factory. Optionally extend this class.
     */
    static create(
        cookieName: string,
        cookieOptions: Partial<SerializeOptions> = {}
    ): new () => ClientIdMiddleware {
        return class extends ClientIdMiddleware {
            constructor() {
                super(cookieName, cookieOptions);
            }
        };
    }

    constructor(private cookieName: string, private cookieOptions: Partial<SerializeOptions> = {}) {}

    use(req: FastifyRequest["raw"], res: FastifyReply["raw"], next: () => void) {
        // @fastify/cookie helpers not available for raw request and reply,
        // so we use cookie package directly

        const cookies = parse(req.headers.cookie || "");
        const clientId = cookies[this.cookieName];

        if (!clientId) {
            const setCookie = serialize(this.cookieName, randomUUID(), {
                httpOnly: true,
                secure: true,
                path: "/",
                ...this.cookieOptions,
            });
            res.appendHeader("Set-Cookie", setCookie);
        }

        next();
    }
}
