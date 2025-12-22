import { UnauthorizedException, type NestMiddleware } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { parse, serialize, type SerializeOptions } from "cookie";
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

export interface ClientIdMiddlewareOptions {
    /**
     * Mode. Extract client ID from header, cookie, or dynamically choose.
     * @default "dynamic"
     */
    mode?: "dynamic" | "header" | "cookie";
    /**
     * @default "X-Client-ID"
     */
    headerName?: string;
    /**
     * @default "client_id"
     */
    cookieName?: string;
    cookieOptions?: Partial<SerializeOptions>;
    /**
     * @default true
     */
    setCookies?: boolean;
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
    static create(options: ClientIdMiddlewareOptions = {}): new () => ClientIdMiddleware {
        return class extends ClientIdMiddleware {
            constructor() {
                super(options);
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

    #cookieOptions: Partial<SerializeOptions>;
    #cookieName: string;
    #headerName: string;
    #mode: ClientIdMiddlewareOptions["mode"];
    #setCookies: boolean = true;

    constructor(options: ClientIdMiddlewareOptions = {}) {
        this.#cookieOptions = options.cookieOptions || {};
        this.#cookieName = options.cookieName || "client_id";
        this.#headerName = options.headerName || "X-Client-ID";
        this.#mode = options.mode || "dynamic";
        this.#setCookies = options.setCookies ?? true;
    }

    use(req: FastifyRequest["raw"], res: FastifyReply["raw"], next: () => void) {
        let clientId: string | undefined = (req as any).clientId;

        // get from existing property
        if (typeof clientId === "string") {
            return next();
        }

        // get from header
        if (this.#mode !== "cookie") {
            // X-Client-ID header takes precedence
            if (typeof req.headers[this.#headerName] === "string") {
                clientId = req.headers[this.#headerName] as string;
                (req as any).clientId = clientId;
                return next();
            }
        }

        // get from cookie
        if (this.#mode !== "header") {
            // Check cookies
            const cookies = parse(req.headers.cookie || "");
            clientId = cookies[this.#cookieName];

            if (!clientId) {
                clientId = randomUUID();

                if (this.#setCookies) {
                    const setCookie = serialize(this.#cookieName, clientId, {
                        httpOnly: true,
                        secure: true,
                        path: "/",
                        ...this.#cookieOptions,
                    });

                    res.appendHeader("Set-Cookie", setCookie);
                }
            }

            (req as any).clientId = clientId;
        }

        next();
    }
}
