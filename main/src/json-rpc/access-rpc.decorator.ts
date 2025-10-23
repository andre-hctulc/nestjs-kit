import { createParamDecorator } from "@nestjs/common";
import { APIAccess, type APIAccessConstructor } from "../common/index.js";
import { RpcException } from "@nestjs/microservices";

/**
 * Decorator to confirm API access. Checks `context.apiAccess` against the provided `AccessClass`.
 * @param AccessClass `ApiAccess` classes to confirm against. If multiple classes are provided, access is granted if any match. Defaults to `APIAccess`.
 */
export const AccessRpc = createParamDecorator<
    APIAccessConstructor | APIAccessConstructor[] | undefined,
    APIAccess
>((AccessClass, ctx) => {
    const ws = ctx.switchToRpc();
    const context = ws.getContext();
    const access = context.apiAccess;

    if (Array.isArray(AccessClass)) {
        let someAccess: APIAccess | null = null;

        for (const Access of AccessClass) {
            try {
                const confirmedAccess = APIAccess.confirm(access, Access);
                if (confirmedAccess) {
                    someAccess = confirmedAccess;
                    break;
                }
            } catch (e) {}
        }

        if (!someAccess) {
            throw new RpcException("Unauthorized");
        }

        return someAccess;
    }

    return APIAccess.confirm(access, AccessClass || APIAccess);
});
