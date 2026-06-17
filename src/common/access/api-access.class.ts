import type { PermissionRef, PermissionRefMap } from "./permissions.types.js";
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

export interface ApiAccessOptions {
    role?: string;
    permissions?: PermissionRef[];
}

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

            if (someAccess.revoked) {
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
    #permissions: PermissionRef[];
    #map: PermissionRefMap;
    #role: string;

    constructor(options: ApiAccessOptions = {}) {
        this.#role = options.role || "";
        this.#permissions = options.permissions || [];
        this.#map = this.#permissions.reduce((map, perm) => {
            map[perm.id] = perm;
            return map;
        }, {} as PermissionRefMap);
    }

    get role(): string {
        return this.#role;
    }

    hasAdminPermissions(): boolean {
        if (this.revoked) {
            return false;
        }
        return this.isAdmin() || this.isOwner();
    }

    /**
     * Checks whether the role is `owner`.
     * Override to implement custom logic.
     */
    isOwner(): boolean {
        return this.role === "owner";
    }

    /**
     * Checks whether the role is `admin`.
     * Override to implement custom logic.
     */
    isAdmin(): boolean {
        return this.role === "admin";
    }

    /**
     * Override to implement custom logic.
     */
    hasPermission(permission: PermissionRef | string): boolean {
        if (this.revoked) {
            return false;
        }
        const pid = typeof permission === "string" ? permission : permission.id;
        return !!this.#map[pid];
    }

    hasPermissions(permissions: (PermissionRef | string)[]): boolean {
        if (this.revoked) {
            return false;
        }
        return permissions.every((p) => this.hasPermission(p));
    }

    /**
     * @throws {AccessDeniedError} if the user does not have the required permissions
     */
    requirePermissions(permissions: (PermissionRef | string)[]): void {
        if (this.revoked || !this.hasPermissions(permissions)) {
            throw new AccessDeniedError("Insufficient permissions");
        }
    }

    #revoked = false;

    revoke(): void {
        this.#revoked = true;
    }

    get revoked(): boolean {
        return this.#revoked;
    }

    getPermissions(): PermissionRef[] {
        return [...this.#permissions];
    }
}
