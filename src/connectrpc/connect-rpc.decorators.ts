import type { HandlerContext } from "@connectrpc/connect";
import { createParamDecorator } from "@nestjs/common";
import { assertConnectRpcContext } from "../rpc/rpc.util.js";
import { MessagePattern } from "@nestjs/microservices";
import type { ConnectRpcMethodPattern } from "./connect-rpc.server.js";

export const ConnectRpcContext = createParamDecorator<HandlerContext>((_data: unknown, ctx) => {
    const context = ctx.switchToRpc().getContext();
    return assertConnectRpcContext(context);
});

export function ConnectRpcMethod(pattern: ConnectRpcMethodPattern): MethodDecorator;
export function ConnectRpcMethod(service: string, method: string): MethodDecorator;
export function ConnectRpcMethod(method: string): MethodDecorator;
export function ConnectRpcMethod(
    serviceOrMethod: ConnectRpcMethodPattern | string,
    method?: string,
): MethodDecorator {
    if (typeof serviceOrMethod === "string" && typeof method === "string") {
        return MessagePattern({ service: serviceOrMethod, method: method });
    } else if (typeof serviceOrMethod === "string") {
        return MessagePattern({ method: serviceOrMethod });
    }
    return MessagePattern(serviceOrMethod);
}
