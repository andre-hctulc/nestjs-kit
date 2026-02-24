import { createParamDecorator } from "@nestjs/common";
import { ApiAccess, commonErrorPayload, type ApiAccessConstructor } from "../common/index.js";
import type { Socket } from "socket.io";
import { WsException } from "@nestjs/websockets";

/**
 * Decorator to confirm api access. Checks `client.handshake.auth.apiAccess` against the provided `AccessClass`.
 * @param AccessClass `ApiAccess` classes to confirm against. If multiple classes are provided, access is granted if any match. Defaults to `APIAccess`.
 */
export const AccessWs = createParamDecorator<
    ApiAccessConstructor | ApiAccessConstructor[] | undefined,
    ApiAccess
>((AccessClass, ctx) => {
    const ws = ctx.switchToWs();
    const client = ws.getClient<Socket>();
    const access = client?.handshake?.auth?.apiAccess;

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
            throw new WsException(commonErrorPayload("Unauthorized"));
        }

        if (someAccess.revoked) {
            throw new WsException(commonErrorPayload("Access denied"));
        }

        return someAccess;
    }

    if (access?.revoked) {
        throw new WsException(commonErrorPayload("Access denied"));
    }

    return ApiAccess.confirm(access, AccessClass || ApiAccess);
});
