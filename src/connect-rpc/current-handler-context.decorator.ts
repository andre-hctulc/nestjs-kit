import type { HandlerContext } from "@connectrpc/connect";
import { createParamDecorator } from "@nestjs/common";
import { assertConnectRpcContext } from "../rpc/rpc.util.js";

export const CurrentHandlerContext = createParamDecorator<HandlerContext>((_data: unknown, ctx) => {
    const request = ctx.switchToRpc().getContext();
    return assertConnectRpcContext(request);
});
