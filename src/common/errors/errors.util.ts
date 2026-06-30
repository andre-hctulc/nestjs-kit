import { HttpException, type ArgumentsHost } from "@nestjs/common";
import type { FastifyReply } from "fastify";

export interface SendErrorOptions {
    httpStatusCode?: number;
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
                options?.httpStatusCode ??
                (originalError instanceof HttpException ? originalError.getStatus() : 500);
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
