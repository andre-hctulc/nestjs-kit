import { UnauthorizedException } from "@nestjs/common";
import type { PermissionDefinition } from "./permissions.model.js";
import { AccessDeniedError } from "./access-denied.error.js";

declare module "fastify" {
    interface FastifyRequest {
        /**
         * Api access attached to the request.
         */
        apiAccess?: ApiAccess;
    }
}

interface ApiAccessOptions {
    role?: string;
    permissions?: PermissionDefinition[];
}

/**
 * Base class for api access.
 */
export abstract class ApiAccess {
    /**
     * @throws UnauthorizedException for mismatches.
     */
    static confirm<T extends ApiAccess>(
        access: unknown,
        Check: (new (...args: any) => T) | (abstract new (...args: any) => T),
    ): T {
        if (!(access instanceof Check)) {
            throw new UnauthorizedException();
        }
        return access;
    }

    readonly api_access = true;
    readonly role: string;
    #permissions: PermissionDefinition[];

    constructor(options: ApiAccessOptions = {}) {
        this.role = options.role || "";
        this.#permissions = options.permissions || [];
    }

    hasAdminPermissions(): boolean {
        if (this.revoked) {
            return false;
        }
        return this.isAdmin() || this.isOwner();
    }

    /**
     * Checks whether the role is `owner`.
     * Override this to implement custom logic.
     */
    isOwner(): boolean {
        return this.role === "owner";
    }

    /**
     * Checks whether the role is `admin`.
     * Override this to implement custom logic.
     */
    isAdmin(): boolean {
        return this.role === "admin";
    }

    /**
     * Override to implement custom logic.
     */
    hasPermission(permission: PermissionDefinition | string): boolean {
        if (this.revoked) {
            return false;
        }
        const permName = typeof permission === "string" ? permission : permission.name;
        return this.#permissions.some((p) => p.name === permName);
    }
    /**
     * Returns false if the permissions array is empty!
     * Uses {@link hasPermission} internally.
     */
    hasPermissions(...permissions: (PermissionDefinition | string)[]): boolean {
        if (this.revoked) {
            return false;
        }
        if (!permissions?.length) {
            return false;
        }
        return permissions.every((p) => this.hasPermission(p));
    }

    /**
     * @throws `AccessDeniedError` if the user does not have the required permissions.
     */
    requirePermissions(...permissions: (PermissionDefinition | string)[]): void {
        if (this.revoked || !this.hasPermissions(...permissions)) {
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

    getPermissions(): PermissionDefinition[] {
        return [...this.#permissions];
    }
}
