import { createParamDecorator } from "@nestjs/common";
import { assertGrpcContext } from "../rpc/rpc.util.js";
import type { Metadata } from "@grpc/grpc-js";

export const GrpcJsContext = createParamDecorator<Metadata>((_data: unknown, ctx) => {
    const context = ctx.switchToRpc().getContext();
    return assertGrpcContext(context);
});
