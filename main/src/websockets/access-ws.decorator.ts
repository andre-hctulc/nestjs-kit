import { createParamDecorator } from "@nestjs/common";
import { APIAccess, commonErrorPayload, type APIAccessConstructor } from "../common/index.js";
import type { Socket } from "socket.io";
import { WsException } from "@nestjs/websockets";

// TODO support different context
/**
 * Decorator to confirm API access. Checks `client.handshake.auth.apiAccess` against the provided `AccessClass`.
 * @param AccessClass `ApiAccess` classes to confirm against. If multiple classes are provided, access is granted if any match. Defaults to `APIAccess`.
 */
export const AccessWS = createParamDecorator<
    APIAccessConstructor | APIAccessConstructor[] | undefined,
    APIAccess
>((AccessClass, ctx) => {
    const ws = ctx.switchToWs();
    const client = ws.getClient<Socket>();
    const access = client?.handshake?.auth?.apiAccess;

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
            throw new WsException(commonErrorPayload("Unauthorized"));
        }

        return someAccess;
    }

    return APIAccess.confirm(access, AccessClass || APIAccess);
});
