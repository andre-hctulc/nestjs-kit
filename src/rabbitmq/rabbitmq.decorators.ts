import { createParamDecorator } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { assertRabbitMqContext } from "../rpc/rpc.util.js";
import { EventPattern, MessagePattern } from "@nestjs/microservices";
import type { RabbitMqEventPattern, RabbitMqMethodPattern } from "./rabbitmq.server.js";

export const RabbitMqHandlerContext = createParamDecorator<ConsumeMessage>((_data: unknown, ctx) => {
    const context = ctx.switchToRpc().getContext();
    return assertRabbitMqContext(context);
});

export function RabbitMqMethod(pattern: RabbitMqMethodPattern): MethodDecorator;
export function RabbitMqMethod(routingKey: string): MethodDecorator;
export function RabbitMqMethod(routingKeyOrPattern: RabbitMqMethodPattern | string): MethodDecorator {
    if (typeof routingKeyOrPattern === "object") {
        return MessagePattern(routingKeyOrPattern);
    }
    return MessagePattern({ routingKey: routingKeyOrPattern });
}

export function RabbitMqEvent(pattern: RabbitMqEventPattern): MethodDecorator;
export function RabbitMqEvent(routingKey: string): MethodDecorator;
export function RabbitMqEvent(routingKeyOrPattern: RabbitMqEventPattern | string): MethodDecorator {
    if (typeof routingKeyOrPattern === "object") {
        return EventPattern(routingKeyOrPattern);
    }
    return EventPattern({ routingKey: routingKeyOrPattern });
}
