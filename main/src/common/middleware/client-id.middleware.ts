import { UnauthorizedException, type NestMiddleware } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { parse, serialize, type SerializeOptions } from "cookie";
import { randomUUID } from "crypto";

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
 *
 * ### Caveats
 *
 * For fastify we receive an internal request object in the middleware, so we cannot define _clientId_ as a property on the request itself.
 * It can still be accessed wih `req.raw.clientId`.
 * 
 * Use {@link ClientIdMiddleware.fromRequest} to get the client ID from the request reliably.
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

    /**
     * Retrieve the client id from a request.
     */
    static fromRequest(req: any): string | undefined {
        if ("raw" in req) {
            return (req.raw as any)?.clientId;
        }
        return req.clientId;
    }

    /**
     * Retrieve the client id from a request.
     * 
     * Throws {@link UnauthorizedException} if the client id is not present.
     */
    static fromRequestOrThrow(req: any): string {
        const clientId = ClientIdMiddleware.fromRequest(req);
        if (!clientId) {
            throw new UnauthorizedException();
        }
        return clientId;
    }

    constructor(private cookieName: string, private cookieOptions: Partial<SerializeOptions> = {}) {}

    // TODO May need adjustments for express
    use(req: FastifyRequest["raw"], res: FastifyReply["raw"], next: () => void) {
        let clientId: string | undefined = (req as any).clientId;

        if (clientId) {
            return next();
        }

        const cookies = parse(req.headers.cookie || "");
        clientId = cookies[this.cookieName];

        if (!clientId) {
            clientId = randomUUID();

            const setCookie = serialize(this.cookieName, randomUUID(), {
                httpOnly: true,
                secure: true,
                path: "/",
                ...this.cookieOptions,
            });

            res.appendHeader("Set-Cookie", setCookie);
        }

        (req as any).clientId = clientId;

        next();
    }
}
