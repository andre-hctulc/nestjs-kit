import { type ArgumentsHost, Catch } from "@nestjs/common";
import type { LogLevel } from "../util/types.js";
import { objectToErrorObject, type CommonErrorObject } from "../util/payloads.util.js";
import { log } from "../util/system/system-util.js";

export type ErrorMapper = (error: unknown) => CommonErrorObject | Error | null | void | undefined;

export interface GlobalExceptionFilterConfig {
    mapErrors?: ErrorMapper;
    /**
     * "verbose": Log all exceptions
     *
     * "error" | "info": Log only unmapped and non rpc errors
     */
    logLevel?: LogLevel;
}

interface InnerConfig {
    defaultErrorCode?: number;
}

/**
 * Catches all errors and maps them to a {@link CommonErrorObject}
 * which is sent back to the client via an "error_event" or a custom event name.
 */
@Catch()
export abstract class GlobalExceptionFilterBase<T> {
    #baseConfig: GlobalExceptionFilterConfig;
    #logLevel: LogLevel;
    #innerConfig: InnerConfig;

    constructor(config: GlobalExceptionFilterConfig = {}, innerConfig: InnerConfig = {}) {
        this.#baseConfig = { ...config };
        this.#logLevel = this.#baseConfig.logLevel || "error";
        this.#innerConfig = { ...innerConfig };
    }

    protected abstract sendError(exception: unknown, error: CommonErrorObject, host: ArgumentsHost): T;

    protected abstract at(host: ArgumentsHost): string;

    catch(exception: unknown, host: ArgumentsHost): T {
        if (this.#baseConfig.mapErrors) {
            exception = this.#baseConfig.mapErrors(exception) || exception;
        }

        let error: CommonErrorObject;
        let unexpected: boolean;

        if (
            exception instanceof Error &&
            "getError" in exception &&
            typeof exception.getError === "function"
        ) {
            unexpected = false;
            // Nestjs WsException
            const message = exception.getError();
            error = objectToErrorObject(message, this.#innerConfig.defaultErrorCode);
        } else {
            unexpected = true;
            error = {
                code: this.#innerConfig.defaultErrorCode ?? 500,
                error: "Internal server error",
                data: {},
            };
        }

        this.#logError(host, exception, true);

        return this.sendError(exception, error, host);
    }

    #logError(host: ArgumentsHost, exception: unknown, unexpected: boolean): void {
        log(this.#logLevel, unexpected ? "verbose" : "error", `ERR at ${this.at(host)}:\n`, exception);
    }
}
