import { createParamDecorator } from "@nestjs/common";
import { ClientIdMiddleware } from "./client-id.middleware.js";

/**
 * @param data - Whether the client ID is required. If true and the client ID is not present, an error is thrown, otherwise an empty string is returned.
 */
export const ClientId = createParamDecorator<boolean, string>((required, ctx) => {
    const http = ctx.switchToHttp();
    const req = http.getRequest();
    return required ? ClientIdMiddleware.fromRequestOrThrow(req) : ClientIdMiddleware.fromRequest(req) ?? "";
});
