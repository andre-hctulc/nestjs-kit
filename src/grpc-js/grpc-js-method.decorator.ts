import { MessagePattern, type PatternMetadata } from "@nestjs/microservices";

export type GrpcJsMethodMetadata = PatternMetadata;

export function GrpcJsMethod(pattern: PatternMetadata): MethodDecorator;
export function GrpcJsMethod(service: string, method: string): MethodDecorator;
export function GrpcJsMethod(
    patternOrService: PatternMetadata | string,
    maybeMethod?: string,
): MethodDecorator {
    if (typeof patternOrService === "string" && typeof maybeMethod === "string") {
        return MessagePattern({ service: patternOrService, method: maybeMethod });
    }

    return MessagePattern(patternOrService as PatternMetadata);
}
