import { createParamDecorator } from "@nestjs/common";
import { assertGrpcJsContext } from "../rpc/rpc.util.js";
import type { Metadata } from "@grpc/grpc-js";
import { MessagePattern, EventPattern } from "@nestjs/microservices";
import type { GrpcEventPattern, GrpcMsPattern } from "./grpc-js.server.js";

export const GrpcContext = createParamDecorator<Metadata>((_data: unknown, ctx) => {
    const context = ctx.switchToRpc().getContext();
    return assertGrpcJsContext(context);
});

export function GrpcMethod(pattern: GrpcMsPattern): MethodDecorator;
export function GrpcMethod(service: string, method: string): MethodDecorator;
export function GrpcMethod(method: string): MethodDecorator;
export function GrpcMethod(patternLike: GrpcMsPattern | string, method?: string): MethodDecorator {
    if (typeof patternLike === "string" && typeof method === "string") {
        return MessagePattern({ service: patternLike, method: method });
    } else if (typeof patternLike === "string") {
        return MessagePattern({ method: patternLike });
    }
    return MessagePattern(patternLike);
}

export function GrpcEvent(pattern: GrpcEventPattern): MethodDecorator;
export function GrpcEvent(service: string, method: string): MethodDecorator;
export function GrpcEvent(method: string): MethodDecorator;
export function GrpcEvent(patternLike: GrpcEventPattern | string, method?: string): MethodDecorator {
    if (typeof patternLike === "string" && typeof method === "string") {
        return EventPattern({ service: patternLike, method: method });
    } else if (typeof patternLike === "string") {
        return EventPattern({ method: patternLike });
    }
    return EventPattern(patternLike);
}
