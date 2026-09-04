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
export function ConnectRpcMethod(methodRef: string): MethodDecorator;
export function ConnectRpcMethod(
    patternLike: ConnectRpcMethodPattern | string,
    method?: string,
): MethodDecorator {
    if (typeof patternLike === "string" && typeof method === "string") {
        return MessagePattern({ service: patternLike, method: method });
    } else if (typeof patternLike === "string") {
        const [service, methodName] = patternLike.split(".");
        if (!methodName) {
            return MessagePattern({ method: service });
        }
        return MessagePattern({ service, method: methodName });
    }
    return MessagePattern(patternLike);
}
