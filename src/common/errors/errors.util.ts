import { HttpException, type ArgumentsHost } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

export interface SendErrorOptions {
    httpStatusCode?: unknown;
}

/**
 * A utility function to send errors in a consistent way across different contexts (HTTP, RPC, WebSockets).
 */
export async function sendError(
    host: ArgumentsHost,
    errorObj: any,
    originalError: unknown,
    options?: SendErrorOptions,
): Promise<any> {
    const contextType = host.getType();

    switch (contextType) {
        case "http": {
            const http = host.switchToHttp();
            const res = http.getResponse<FastifyReply>();
            const status =
                typeof options?.httpStatusCode === "number"
                    ? options.httpStatusCode
                    : originalError instanceof HttpException
                      ? originalError.getStatus()
                      : 500;
            res.status(status).header("Content-Type", "application/json").send(errorObj);
            break;
        }
        case "rpc":
            // TODO test: Can nest handle Promise<Observable> return types from RPC handlers?
            const rxjs = await import("rxjs");
            return rxjs.throwError(() => errorObj);
        case "ws":
            // TODO this is a very naive implementation, we should ideally have some way to specify the event name to emit on
            const ws = host.switchToWs();
            const client = ws.getClient();
            client.emit("error", errorObj);
            break;
    }
}

export function getErrorLocationDescription(host: ArgumentsHost): string {
    const type = host.getType();

    switch (type) {
        case "http": {
            const MAX_URL_DISPLAY_LENGTH = 100;
            const ctx = host.switchToHttp();
            const req: FastifyRequest = ctx.getRequest();
            const urlStr =
                req.url.length > MAX_URL_DISPLAY_LENGTH
                    ? `${req.url.slice(0, MAX_URL_DISPLAY_LENGTH)}...`
                    : req.url;
            return `(${req.method.toUpperCase()}) ${urlStr}`;
        }
        case "ws": {
            const ctx = host.switchToWs();
            const client = ctx.getClient();
            return `WS [${client.id}]`;
        }
        case "rpc": {
            const ctx = host.switchToRpc();

            if (!ctx || typeof ctx !== "object") {
                return "RPC";
            }

            // TCP, RMQ → getPattern()
            else if ("getPattern" in ctx && typeof ctx.getPattern === "function") {
                return String(ctx.getPattern());
            }
            // Kafka, MQTT → getTopic()
            else if ("getTopic" in ctx && typeof ctx.getTopic === "function") {
                return String(ctx.getTopic());
            }
            // NATS → getSubject()
            else if ("getSubject" in ctx && typeof ctx.getSubject === "function") {
                return String(ctx.getSubject());
            }
            // Redis → getChannel()
            else if ("getChannel" in ctx && typeof ctx.getChannel === "function") {
                return String(ctx.getChannel());
            } else {
                return "RPC";
            }
        }
        default:
            return "";
    }
}
