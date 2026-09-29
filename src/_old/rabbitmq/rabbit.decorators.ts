import { createParamDecorator } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { assertRabbitMqContext } from "../rpc/rpc.util.js";
import { EventPattern, MessagePattern } from "@nestjs/microservices";
import type { RabbitEventPattern, RabbitMsPattern } from "./rabbitmq.server.js";

export const RabbitMqContext = createParamDecorator<ConsumeMessage>((_data: unknown, ctx) => {
    const context = ctx.switchToRpc().getContext();
    return assertRabbitMqContext(context);
});

export function RabbitMethod(pattern: RabbitMsPattern): MethodDecorator;
export function RabbitMethod(routingKey: string): MethodDecorator;
export function RabbitMethod(routingKeyOrPattern: RabbitMsPattern | string): MethodDecorator {
    if (typeof routingKeyOrPattern === "object") {
        return MessagePattern(routingKeyOrPattern);
    }
    return MessagePattern({ routingKey: routingKeyOrPattern });
}

export function RabbitEvent(pattern: RabbitEventPattern): MethodDecorator;
export function RabbitEvent(routingKey: string): MethodDecorator;
export function RabbitEvent(routingKeyOrPattern: RabbitEventPattern | string): MethodDecorator {
    if (typeof routingKeyOrPattern === "object") {
        return EventPattern(routingKeyOrPattern);
    }
    return EventPattern({ routingKey: routingKeyOrPattern });
}
