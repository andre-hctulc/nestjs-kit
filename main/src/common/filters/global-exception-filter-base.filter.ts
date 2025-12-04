import { type ArgumentsHost, Catch, HttpException, type LogLevel } from "@nestjs/common";
import { objectToErrorObject, type CommonErrorObject } from "../util/payloads.util.js";
import { defaultLogLevel, log, logRaw } from "../util/logs.util.js";

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
        this.#logLevel = this.#baseConfig.logLevel || defaultLogLevel();
        this.#innerConfig = { ...innerConfig };
    }

    protected abstract sendError(
        originalException: unknown,
        mappedException: unknown,
        error: CommonErrorObject,
        host: ArgumentsHost
    ): T;

    protected abstract at(host: ArgumentsHost): string;

    catch(exception: unknown, host: ArgumentsHost): T {
        const originalException = exception;
        let mappedException: unknown = undefined;

        if (this.#baseConfig.mapErrors) {
            exception = this.#baseConfig.mapErrors(exception) || exception;
            mappedException = exception;
        }

        let error: CommonErrorObject;
        let unexpected: boolean;

        // WsException/RpcException
        if (
            exception instanceof Error &&
            "getError" in exception &&
            typeof exception.getError === "function"
        ) {
            unexpected = false;
            // Nestjs WsException
            const message = exception.getError();
            error = objectToErrorObject(message, this.#innerConfig.defaultErrorCode);
        }
        // HttpException
        else if (exception instanceof HttpException) {
            unexpected = false;
            const message = exception.getResponse();
            error = objectToErrorObject(message, this.#innerConfig.defaultErrorCode);
        }
        // Generic Error
        else {
            unexpected = true;
            error = {
                code: this.#innerConfig.defaultErrorCode ?? 500,
                error: "Internal server error",
                data: {},
            };
        }

        this.#logError(host, exception, true);

        return this.sendError(originalException, mappedException, error, host);
    }

    #logError(host: ArgumentsHost, exception: unknown, unexpected: boolean): void {
        const severity = unexpected ? "error" : "debug";
        log(severity, this.#logLevel, `At ${this.at(host)}:`);
        logRaw(severity, this.#logLevel, exception);
    }
}
