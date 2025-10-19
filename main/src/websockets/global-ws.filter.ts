import { ArgumentsHost, Catch, WsExceptionFilter } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { CommonErrorObject, LogLevel, objectErrorObject } from "../common/index.js";

export type JsonRpcErrorMapper = (
    error: unknown
) => CommonErrorObject | WsException | null | void | undefined;

export interface GlobalWsExceptionFilterConfig {
    mapErrors?: JsonRpcErrorMapper;
    /**
     * "verbose": Log all exceptions
     *
     * "error" | "info": Log only unmapped and non rpc errors
     */
    logLevel?: LogLevel;
    /**
     * @default "error_event"
     */
    errorEventName?: string;
}

/**
 * Catches all errors and maps them to a {@link CommonErrorObject}
 * which is sent back to the client via an "error_event" or a custom event name.
 */
@Catch()
export class GlobalWsExceptionFilter implements WsExceptionFilter {
    constructor(private _config: GlobalWsExceptionFilterConfig = {}) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToWs();
        const client = ctx.getClient<Socket>();

        let errObj: CommonErrorObject;

        if (this._config.mapErrors) {
            exception = this._config.mapErrors(exception) || exception;
        }

        // Nestjs WsException
        if (exception instanceof WsException) {
            const message = exception.getError();
            errObj = objectErrorObject(message);
        }
        // Mapped error object
        else if (!(exception instanceof Error) && exception && typeof exception === "object") {
            errObj = objectErrorObject(exception);
        }
        // Unrecognized error, map to generic internal server error
        else {
            errObj = {
                message: "Internal Server Error",
                code: 500,
                details: {},
            };
        }

        client.emit(this._config.errorEventName ?? "error_event", errObj);
    }
}
