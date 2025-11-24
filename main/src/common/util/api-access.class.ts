import { UnauthorizedException } from "@nestjs/common";
import type { PermissionDefinition } from "./permissions.model.js";
import { hasPermission } from "./permissions.util.js";
import { AccessDeniedError } from "../errors/common-errors.js";

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
    readonly role: string = "";

    constructor(role?: string) {
        if (role) {
            this.role = role;
        }
    }

    hasAdminPermissions(): boolean {
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
     * Returns false if the permissions array is empty!
     */
    hasPermissions(...permissions: PermissionDefinition[]): boolean {
        if (!permissions?.length) {
            return false;
        }
        return permissions.every((p) => hasPermission(this.role, p));
    }

    /**
     * @throws `AccessDeniedError` if the user does not have the required permissions.
     */
    requirePermissions(...permissions: PermissionDefinition[]): void {
        if (!this.hasPermissions(...permissions)) {
            throw new AccessDeniedError("insufficient permissions");
        }
    }
}
