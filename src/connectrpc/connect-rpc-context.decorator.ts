import type { HandlerContext } from "@connectrpc/connect";
import { createParamDecorator } from "@nestjs/common";
import { assertConnectRpcContext } from "../rpc/rpc.util.js";

export const ConnectRpcContext = createParamDecorator<HandlerContext>((_data: unknown, ctx) => {
    const context = ctx.switchToRpc().getContext();
    return assertConnectRpcContext(context);
});
