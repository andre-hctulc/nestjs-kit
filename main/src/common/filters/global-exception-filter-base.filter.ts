import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { objectToErrorObject, type CommonErrorObject } from "../util/payloads.util.js";
import { sendError } from "../util/send-error.util.js";

export type ErrorMapper = (error: unknown) => CommonErrorObject | Error | null | void | undefined;

/**
 * Catches all errors and maps them to a {@link CommonErrorObject}
 */
@Catch()
export abstract class GlobalExceptionFilterBase<T> implements ExceptionFilter {
    #logger = new Logger(this.constructor.name);

    constructor() {}

    protected abstract at(host: ArgumentsHost): string;

    protected sendError(
        host: ArgumentsHost,
        error: CommonErrorObject,
        originalException: unknown,
    ): Promise<T> {
        return sendError(host, error, originalException);
    }

    async catch(exception: unknown, host: ArgumentsHost) {
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
            error = objectToErrorObject(undefined);
        }

        this.#logError(host, exception, unexpected);

        return await this.sendError(host, error, originalException);
    }

    #logError(host: ArgumentsHost, exception: unknown, unexpected: boolean): void {
        const at = `at ${this.at(host)}`;
        if (unexpected) {
            this.#logger.error(at, exception);
        } else {
            this.#logger.debug(at, exception);
        }
    }
}
