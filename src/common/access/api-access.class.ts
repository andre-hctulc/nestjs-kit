import { AccessDeniedError } from "./access-denied.error.js";
import type { ApiAccessConstructor } from "./access.types.js";

declare module "fastify" {
    interface FastifyRequest {
        /**
         * Api access attached to the request.
         */
        apiAccess?: ApiAccess;
    }
}

export interface ApiAccessOptions {}

/**
 * Base class for api access.
 */
export abstract class ApiAccess {
    /**
     * @throws {AccessDeniedError} for mismatches
     */
    static confirm<T extends ApiAccess>(
        access: unknown,
        Check: ApiAccessConstructor<T> | ApiAccessConstructor<T>[],
    ): T {
        if (!access) {
            throw new AccessDeniedError();
        }

        if (Array.isArray(Check)) {
            let someAccess: T | null = null;

            for (const Access of Check) {
                try {
                    const confirmedAccess = ApiAccess.confirm(access, Access);
                    if (confirmedAccess) {
                        someAccess = confirmedAccess;
                        break;
                    }
                } catch (e) {}
            }

            if (!someAccess) {
                throw new AccessDeniedError();
            }

            return someAccess;
        }

        if (!(access instanceof Check)) {
            throw new AccessDeniedError();
        }

        return access as T;
    }

    readonly api_access = true;

    constructor(options: ApiAccessOptions = {}) {}
}
