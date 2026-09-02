import { createParamDecorator } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { assertRabbitMqContext } from "../rpc/rpc.util.js";

export const RabbitMqHandlerContext = createParamDecorator<ConsumeMessage>((_data: unknown, ctx) => {
    const context = ctx.switchToRpc().getContext();
    return assertRabbitMqContext(context);
});
