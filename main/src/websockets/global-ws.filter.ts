import { type ArgumentsHost, Catch, type WsExceptionFilter } from "@nestjs/common";
import type { Socket } from "socket.io";
import { type CommonErrorObject } from "../common/index.js";
import {
    GlobalExceptionFilterBase,
    type GlobalExceptionFilterConfig,
} from "../common/filters/global-exception-filter-base.filter.js";

export interface GlobalWsExceptionFilterConfig extends GlobalExceptionFilterConfig {
    /**
     * Used for websocket errors.
     * @default "error_event"
     */
    errorEventName?: string;
}

/**
 * Catches all errors and maps them to a {@link CommonErrorObject} 
 * which is sent back to the client via an "error_event" or a custom event name.
 */
@Catch()
export abstract class GlobalWsExceptionFilter
    extends GlobalExceptionFilterBase<void>
    implements WsExceptionFilter
{
    #config: GlobalWsExceptionFilterConfig;

    constructor(config: GlobalWsExceptionFilterConfig = {}) {
        super(config);
        this.#config = { ...config };
    }

    protected override sendError(exception: unknown, error: CommonErrorObject, host: ArgumentsHost): void {
        const ctx = host.switchToWs();
        const client = ctx.getClient<Socket>();
        client.emit(this.#config.errorEventName ?? "error_event", error);
    }

    protected override at(host: ArgumentsHost): string {
        const ctx = host.switchToWs();
        const client = ctx.getClient<Socket>();
        return `WS [${client.id}]`;
    }
}
