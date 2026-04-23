import { type ArgumentsHost, Catch, type WsExceptionFilter } from "@nestjs/common";
import type { Socket } from "socket.io";
import { type CommonErrorObject } from "../common/index.js";
import { GlobalExceptionFilterBase } from "../common/filters/global-exception-filter-base.filter.js";

/**
 * Catch all errors, map them to a {@link CommonErrorObject}s and send to client.
 */
@Catch()
export class GlobalWsExceptionFilter extends GlobalExceptionFilterBase<void> implements WsExceptionFilter {
    protected override at(host: ArgumentsHost): string {
        const ctx = host.switchToWs();
        const client = ctx.getClient<Socket>();
        return `WS [${client.id}]`;
    }
}
