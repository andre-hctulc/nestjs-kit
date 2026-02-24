import { UnauthorizedException } from "@nestjs/common";
import type { PermissionDefinition } from "./permissions.model.js";
import { hasPermission as hasPerm } from "./permissions.util.js";
import { AccessDeniedError } from "../errors/common-errors.js";

declare module "fastify" {
    interface FastifyRequest {
        /**
         * Api access attached to the request.
         */
        apiAccess?: ApiAccess;
    }
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
    readonly role: string = "";

    constructor(role?: string) {
        if (role) {
            this.role = role;
        }
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
    hasPermission(permission: PermissionDefinition): boolean {
        if (this.revoked) {
            return false;
        }
        return hasPerm(this.role, permission);
    }
    /**
     * Returns false if the permissions array is empty!
     * Uses {@link hasPermission} internally.
     */
    hasPermissions(...permissions: PermissionDefinition[]): boolean {
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
    requirePermissions(...permissions: PermissionDefinition[]): void {
        if (this.revoked || !this.hasPermissions(...permissions)) {
            throw new AccessDeniedError("insufficient permissions");
        }
    }

    #revoked = false;

    revoke(): void {
        this.#revoked = true;
    }

    get revoked(): boolean {
        return this.#revoked;
    }
}
