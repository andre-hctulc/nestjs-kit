import { MessagePattern, type PatternMetadata } from "@nestjs/microservices";
import type { ConnectMethodPattern } from "./connect-rpc.server.js";

export function ConnectRpcMethod(pattern: ConnectMethodPattern): MethodDecorator;
export function ConnectRpcMethod(service: string, method: string): MethodDecorator;
export function ConnectRpcMethod(methodRef: string): MethodDecorator;
export function ConnectRpcMethod(
    patternOrService: PatternMetadata | string,
    maybeMethod?: string,
): MethodDecorator {
    if (typeof patternOrService === "string" && typeof maybeMethod === "string") {
        return MessagePattern({ service: patternOrService, method: maybeMethod });
    }
    return MessagePattern(patternOrService as PatternMetadata);
}
