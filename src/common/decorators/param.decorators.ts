import { createParamDecorator } from "@nestjs/common";

export const CurrentExecutionContext = createParamDecorator((data, ctx) => {
    return ctx;
});
