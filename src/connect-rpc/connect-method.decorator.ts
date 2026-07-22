import { MessagePattern, type PatternMetadata } from "@nestjs/microservices";

export type ConnectMethodMetadata = PatternMetadata;

export function ConnectMethod(pattern: PatternMetadata): MethodDecorator;
export function ConnectMethod(service: string, method: string): MethodDecorator;
export function ConnectMethod(
    patternOrService: PatternMetadata | string,
    maybeMethod?: string,
): MethodDecorator {
    if (typeof patternOrService === "string" && typeof maybeMethod === "string") {
        return MessagePattern({ service: patternOrService, method: maybeMethod });
    }

    return MessagePattern(patternOrService as PatternMetadata);
}
