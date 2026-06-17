import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export const RpcData = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToRpc().getData();
});
