import { createParamDecorator } from "@nestjs/common";
import { assertGrpcJsContext } from "../rpc/rpc.util.js";
import type { Metadata } from "@grpc/grpc-js";
import { MessagePattern } from "@nestjs/microservices";
import type { GrpcJsMethodPattern } from "./grpc-js.server.js";

export const GrpcJsContext = createParamDecorator<Metadata>((_data: unknown, ctx) => {
    const context = ctx.switchToRpc().getContext();
    return assertGrpcJsContext(context);
});

export function GrpcJsMethod(pattern: GrpcJsMethodPattern): MethodDecorator;
export function GrpcJsMethod(service: string, method: string): MethodDecorator;
export function GrpcJsMethod(method: string): MethodDecorator;
export function GrpcJsMethod(patternLike: GrpcJsMethodPattern | string, method?: string): MethodDecorator {
    if (typeof patternLike === "string" && typeof method === "string") {
        return MessagePattern({ service: patternLike, method: method });
    } else if (typeof patternLike === "string") {
        return MessagePattern({ method: patternLike });
    }
    return MessagePattern(patternLike);
}
