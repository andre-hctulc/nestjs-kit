import { type NestMiddleware } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { parse, serialize, SerializeOptions } from "cookie";
import { randomUUID } from "crypto";

export class ClientIdMiddleware implements NestMiddleware {
    constructor(private cookieName: string, private cookieOptions: Partial<SerializeOptions>) {}

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
