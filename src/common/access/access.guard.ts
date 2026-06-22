import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ApiAccess, getRequestedPermissions, type ApiAccessConstructor } from "../index.js";
import type { MaybePromise } from "../util/system/system-types.js";

export interface ValidateAccessContext {
    requestedPermissions: string[];
    context: ExecutionContext;
}

export abstract class AccessGuard<A extends ApiAccess = ApiAccess> implements CanActivate {
    #type: ApiAccessConstructor<A>;

    constructor(type?: ApiAccessConstructor<A>) {
        this.#type = type ?? (ApiAccess as any);
    }

    abstract validateAccess(access: A, context: ValidateAccessContext): MaybePromise<boolean>;

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const http = context.switchToHttp();
        const req = http.getRequest();

        context.switchToRpc().getContext();

        const apiAccess = ApiAccess.confirm(req.apiAccess, this.#type);

        return await this.validateAccess(apiAccess, {
            requestedPermissions: getRequestedPermissions(context),
            context,
        });
    }
}
