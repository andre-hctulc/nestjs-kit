import { createParamDecorator } from "@nestjs/common";
import { ApiAccess, type ApiAccessConstructor } from "../common/index.js";

/**
 * Looks up the API access from the RPC context object (`<context>.apiAccess`) and verifies it.
 * @param AccessClass `ApiAccess` classes to confirm against
 */
export const RpcAccess = createParamDecorator<
    ApiAccessConstructor | ApiAccessConstructor[] | undefined,
    ApiAccess
>((AccessClass, ctx) => {
    const http = ctx.switchToRpc();
    const rpcCtx: unknown = http.getContext();
    const access =
        typeof rpcCtx === "object" && rpcCtx !== null && "apiAccess" in rpcCtx ? rpcCtx.apiAccess : undefined;
    return ApiAccess.confirm(access, AccessClass || ApiAccess);
});
