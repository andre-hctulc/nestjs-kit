import type { HandlerContext } from "@connectrpc/connect";
import { createParamDecorator } from "@nestjs/common";
import { assertConnectRpcContext } from "../rpc/rpc.util.js";
import { EventPattern, MessagePattern } from "@nestjs/microservices";
import type { ConnectEventPattern, ConnectMsPattern } from "./connect-rpc.server.js";

export const ConnectContext = createParamDecorator<HandlerContext>((_data: unknown, ctx) => {
    const context = ctx.switchToRpc().getContext();
    return assertConnectRpcContext(context);
});

/**
 * Connect RPC method handler
 */
export function ConnectMethod(pattern: ConnectMsPattern): MethodDecorator;
export function ConnectMethod(service: string, method: string): MethodDecorator;
export function ConnectMethod(method: string): MethodDecorator;
export function ConnectMethod(patternLike: ConnectMsPattern | string, method?: string): MethodDecorator {
    if (typeof patternLike === "string" && typeof method === "string") {
        return MessagePattern({ service: patternLike, method: method });
    } else if (typeof patternLike === "string") {
        return MessagePattern({ method: patternLike });
    }
    return MessagePattern(patternLike);
}

/**
 * Connect RPC event handler
 */
export function ConnectEvent(pattern: ConnectEventPattern): MethodDecorator;
export function ConnectEvent(service: string, method: string): MethodDecorator;
export function ConnectEvent(method: string): MethodDecorator;
export function ConnectEvent(patternLike: ConnectEventPattern | string, method?: string): MethodDecorator {
    if (typeof patternLike === "string" && typeof method === "string") {
        return EventPattern({ service: patternLike, method: method });
    } else if (typeof patternLike === "string") {
        return EventPattern({ method: patternLike });
    }
    return EventPattern(patternLike);
}
