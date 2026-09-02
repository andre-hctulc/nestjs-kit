import { MessagePattern } from "@nestjs/microservices";
import type { RabbitMqMethodPattern } from "./rabbitmq.server.js";

export function RabbitMqMethod(pattern: RabbitMqMethodPattern): MethodDecorator;
export function RabbitMqMethod(service: string, method: string): MethodDecorator;
export function RabbitMqMethod(
    patternOrService: RabbitMqMethodPattern | string,
    maybeMethod?: string,
): MethodDecorator {
    if (typeof patternOrService === "string" && typeof maybeMethod === "string") {
        return MessagePattern({ service: patternOrService, method: maybeMethod });
    }

    return MessagePattern(patternOrService as RabbitMqMethodPattern);
}
