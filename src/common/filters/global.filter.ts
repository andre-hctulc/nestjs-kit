import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { sendError } from "../errors/errors.util.js";
import type { FastifyRequest } from "fastify";
import { ServiceError } from "../errors/service-error.class.js";
import type { ErrorShape } from "../errors/error-shape.interface.js";

export type ErrorMapper = (error: unknown) => ErrorShape | Error | null | void | undefined;

/**
 * Catches all errors and maps them to a {@link ErrorShape}
 */
@Catch()
export class GlobalExceptionFilter<T> implements ExceptionFilter {
    #logger = new Logger(this.constructor.name);

    async catch(exception: unknown, host: ArgumentsHost) {
        const originalException = exception;
        let error: ErrorShape;
        let unexpected: boolean;

        // ServiceError
        if (ServiceError.isServiceError(exception)) {
            unexpected = false;
            error = {
                code: exception.code,
                message: exception.message,
                details: exception.details,
            };
        }
        // WsException/RpcException
        else if (
            exception instanceof Error &&
            "getError" in exception &&
            typeof exception.getError === "function"
        ) {
            unexpected = false;
            const message = exception.getError();
            error = {
                code: "UNKNOWN",
                message: String(message),
                details: null,
            };
        }
        // HttpException
        else if (exception instanceof HttpException) {
            unexpected = false;
            
            let message = exception.getResponse();
            if (typeof message === "object") {
                message = String((message as any).message || "");
            }

            error = {
                code: String(exception.getStatus()),
                message: String(message),
                details: null,
            };
        }
        // Generic Error
        else {
            unexpected = true;
            error = {
                code: "UNKNOWN",
                message: "An unexpected error occurred",
                details: null,
            };
        }

        this.#logError(host, exception, unexpected);

        return await sendError(host, error, originalException);
    }

    #logError(host: ArgumentsHost, exception: unknown, unexpected: boolean): void {
        const type = host.getType();
        let at: string;

        switch (type) {
            case "http": {
                const MAX_URL_DISPLAY_LENGTH = 100;
                const ctx = host.switchToHttp();
                const req: FastifyRequest = ctx.getRequest();
                const urlStr =
                    req.url.length > MAX_URL_DISPLAY_LENGTH
                        ? `${req.url.slice(0, MAX_URL_DISPLAY_LENGTH)}...`
                        : req.url;
                at = `(${req.method.toUpperCase()}) ${urlStr}`;
                break;
            }
            case "ws": {
                const ctx = host.switchToWs();
                const client = ctx.getClient();
                at = `WS [${client.id}]`;
                break;
            }
            case "rpc": {
                const ctx = host.switchToRpc();

                if (!ctx || typeof ctx !== "object") {
                    at = "RPC";
                }

                // TCP, RMQ → getPattern()
                else if ("getPattern" in ctx && typeof ctx.getPattern === "function") {
                    at = String(ctx.getPattern());
                }
                // Kafka, MQTT → getTopic()
                else if ("getTopic" in ctx && typeof ctx.getTopic === "function") {
                    at = String(ctx.getTopic());
                }
                // NATS → getSubject()
                else if ("getSubject" in ctx && typeof ctx.getSubject === "function") {
                    at = String(ctx.getSubject());
                }
                // Redis → getChannel()
                else if ("getChannel" in ctx && typeof ctx.getChannel === "function") {
                    at = String(ctx.getChannel());
                } else {
                    at = "RPC";
                }

                break;
            }
        }

        if (unexpected) {
            this.#logger.error(`Unexpected error at ${at}`, exception);
        } else {
            this.#logger.debug(`Error at ${at}:`, exception);
        }
    }
}
