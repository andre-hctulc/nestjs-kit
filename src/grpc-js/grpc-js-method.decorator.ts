import { MessagePattern, type PatternMetadata } from "@nestjs/microservices";
import type { GrpcJsMethodPattern } from "./grpc-js.server.js";

export function GrpcJsMethod(pattern: GrpcJsMethodPattern): MethodDecorator;
export function GrpcJsMethod(service: string, method: string): MethodDecorator;
export function GrpcJsMethod(methodRef: string): MethodDecorator;
export function GrpcJsMethod(
    patternOrService: PatternMetadata | string,
    maybeMethod?: string,
): MethodDecorator {
    if (typeof patternOrService === "string" && typeof maybeMethod === "string") {
        return MessagePattern({ service: patternOrService, method: maybeMethod });
    }
    return MessagePattern(patternOrService as PatternMetadata);
}
