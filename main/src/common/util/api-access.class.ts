import { UnauthorizedException } from "@nestjs/common";

declare module "fastify" {
    interface FastifyRequest {
        /**
         * API access attached to the request.
         */
        apiAccess?: APIAccess;
    }
}

/**
 * Base class for API access.
 */
export abstract class APIAccess {
    /**
     * @throws UnauthorizedException for mismatches.
     */
    static confirm<T extends APIAccess>(
        access: unknown,
        Check: (new (...args: any) => T) | (abstract new (...args: any) => T)
    ): T {
        if (!(access instanceof Check)) {
            throw new UnauthorizedException();
        }
        return access;
    }

    readonly api_access = true;
}
