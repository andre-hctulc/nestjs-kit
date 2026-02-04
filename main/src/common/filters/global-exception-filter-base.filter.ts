import { type ArgumentsHost, Catch, HttpException, ConsoleLogger } from "@nestjs/common";
import { objectToErrorObject, type CommonErrorObject } from "../util/payloads.util.js";

export type ErrorMapper = (error: unknown) => CommonErrorObject | Error | null | void | undefined;

/**
 * Catches all errors and maps them to a {@link CommonErrorObject}
 * which is sent back to the client via an "error_event" or a custom event name.
 */
@Catch()
export abstract class GlobalExceptionFilterBase<T> {
    #logger = new ConsoleLogger(GlobalExceptionFilterBase.name);

    constructor() {}

    protected abstract sendError(exception: unknown, errorObj: CommonErrorObject, host: ArgumentsHost): T;

    protected abstract at(host: ArgumentsHost): string;

    catch(exception: unknown, host: ArgumentsHost): T {
        const originalException = exception;
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
            error = objectToErrorObject(message);
        }
        // HttpException
        else if (exception instanceof HttpException) {
            unexpected = false;
            const message = exception.getResponse();
            error = objectToErrorObject(message);
        }
        // Generic Error
        else {
            unexpected = true;
            error = {
                code: 500,
                error: "Internal server error",
                data: {},
            };
        }

        this.#logError(host, exception, true);

        return this.sendError(originalException, error, host);
    }

    #logError(host: ArgumentsHost, exception: unknown, unexpected: boolean): void {
        this.#logger.log(`At ${this.at(host)}:`);
        this.#logger.log(exception);
    }
}
