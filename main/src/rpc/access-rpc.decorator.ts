import { createParamDecorator } from "@nestjs/common";
import { ApiAccess, type ApiAccessConstructor } from "../common/index.js";
import { RpcAccessDeniedError } from "./rpc.errors.js";

/**
 * Decorator to confirm api access. Checks `context.apiAccess` against the provided `AccessClass`.
 * @param AccessClass `ApiAccess` classes to confirm against. If multiple classes are provided, access is granted if any match. Defaults to `ApiAccess`.
 */
export const AccessRpc = createParamDecorator<
    ApiAccessConstructor | ApiAccessConstructor[] | undefined,
    ApiAccess
>((AccessClass, ctx) => {
    const rpc = ctx.switchToRpc();
    const context = rpc.getContext();
    const access = context.apiAccess;

    if (Array.isArray(AccessClass)) {
        let someAccess: ApiAccess | null = null;

        for (const Access of AccessClass) {
            try {
                const confirmedAccess = ApiAccess.confirm(access, Access);
                if (confirmedAccess) {
                    someAccess = confirmedAccess;
                    break;
                }
            } catch (e) {}
        }

        if (!someAccess) {
            throw new RpcAccessDeniedError();
        }

        if (someAccess.revoked) {
            throw new RpcAccessDeniedError();
        }

        return someAccess;
    }

    if (access?.revoked) {
        throw new RpcAccessDeniedError();
    }

    return ApiAccess.confirm(access, AccessClass || ApiAccess);
});
