import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { ApiAccessConstructor } from "./access.types.js";
import { AccessDeniedError, ApiAccess, type PermissionRef } from "../index.js";

export interface AccessSpec {
    type?: ApiAccessConstructor | ApiAccessConstructor[];
    permissions?: (string | PermissionRef)[];
    role?: string;
}

export class AccessGuard implements CanActivate {
    #role: string | undefined;
    #permissions: string[];
    #accessTypes: ApiAccessConstructor[];

    constructor(spec: AccessSpec) {
        this.#role = spec.role;
        this.#permissions =
            spec.permissions?.map((perm) => (typeof perm === "string" ? perm : perm.id)) || [];
        this.#accessTypes = Array.isArray(spec.type) ? spec.type : spec.type ? [spec.type] : [ApiAccess];
        if (!this.#accessTypes.length) {
            this.#accessTypes = [ApiAccess];
        }
    }

    canActivate(context: ExecutionContext): boolean {
        const http = context.switchToHttp();
        const req = http.getRequest();

        context.switchToRpc().getContext();

        // validate `type`
        const apiAccess = ApiAccess.confirm(req.apiAccess, this.#accessTypes);

        // validate `role`
        if (this.#role !== undefined) {
            if (apiAccess.role !== this.#role) {
                throw new AccessDeniedError();
            }
        }

        // validate `permissions`
        if (this.#permissions.length) {
            if (!apiAccess.hasPermissions(this.#permissions)) {
                throw new AccessDeniedError();
            }
        }

        return true;
    }
}
