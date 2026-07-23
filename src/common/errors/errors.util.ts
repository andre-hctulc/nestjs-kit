import { type ArgumentsHost } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { isConnectRpcContext, isGrpcContext } from "../../rpc/rpc.util.js";

/**
 * A utility function to send errors in a consistent way across different contexts (HTTP, RPC, WebSockets).
 */
export async function sendError(
    host: ArgumentsHost,
    errorObject: any,
    unmappedStatusCode: number,
): Promise<any> {
    const contextType = host.getType();

    switch (contextType) {
        case "http": {
            const http = host.switchToHttp();
            const res = http.getResponse<FastifyReply>();
            const mappedStatusCode = mapToHttpStatusCode(unmappedStatusCode);
            res.status(mappedStatusCode).header("Content-Type", "application/json").send(errorObject);
            break;
        }
        case "rpc":
            const rxjs = await import("rxjs");
            const ctx = host.switchToRpc();
            const isGrpcLike = isGrpcContext(ctx) || isConnectRpcContext(ctx);
            let mappedStatusCode: number;

            if (isGrpcLike) {
                mappedStatusCode = mapToGrpcStatusCode(unmappedStatusCode);
            } else {
                mappedStatusCode = mapToJsonRpcStatusCode(unmappedStatusCode);
            }

            // Add rpc status code to the error object if it doesn't already have one
            if (errorObject && typeof errorObject === "object") {
                errorObject.code = mappedStatusCode;
            }

            return rxjs.throwError(() => errorObject);
        case "ws":
            const ws = host.switchToWs();
            const client = ws.getClient();
            client.emit("error", errorObject);
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

            // Grpc - Metadata carries no method/service info
            if (isGrpcContext(ctx)) {
                return "gRPC";
            }
            // ConnectRPC - HandlerContext has service and method descriptors
            else if (isConnectRpcContext(ctx)) {
                return `ConnectRPC [${ctx.service.typeName}/${ctx.method.name}]`;
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

function mapToJsonRpcStatusCode(statusCode: number): number {
    if (statusCode <= 0) {
        return statusCode; // Already a JSON-RPC status code
    }

    // grpc
    else if (statusCode === 0) {
        return 0; // OK
    } else if (statusCode === 3) {
        return -32600; // Invalid Request
    } else if (statusCode === 16) {
        return -32601; // Unauthorized
    } else if (statusCode === 7) {
        return -32602; // Forbidden
    } else if (statusCode === 5) {
        return -32603; // Not Found
    } else if (statusCode === 6) {
        return -32604; // Conflict
    } else if (statusCode === 13) {
        return -32000; // Internal Server Error
    }

    // http
    else if (statusCode >= 200 && statusCode < 300) {
        return 0; // OK
    } else if (statusCode === 400) {
        return -32600; // Invalid Request
    } else if (statusCode === 401) {
        return -32601; // Unauthorized
    } else if (statusCode === 403) {
        return -32602; // Forbidden
    } else if (statusCode === 404) {
        return -32603; // Not Found
    } else if (statusCode === 409) {
        return -32604; // Conflict
    } else if (statusCode >= 500 && statusCode < 600) {
        return -32000; // Internal Server Error
    }

    return -32000; // Unknown Error
}

function mapToGrpcStatusCode(rpcStatusCode: number): number {
    if (rpcStatusCode >= 0 && rpcStatusCode <= 16) {
        return rpcStatusCode; // Already a grpc status code
    }

    // json rpc
    else if (rpcStatusCode === 0) {
        return 0; // OK
    } else if (rpcStatusCode === -32600) {
        return 3; // Invalid Argument
    } else if (rpcStatusCode === -32601) {
        return 16; // Unauthenticated
    } else if (rpcStatusCode === -32602) {
        return 7; // Permission Denied
    } else if (rpcStatusCode === -32603) {
        return 5; // Not Found
    } else if (rpcStatusCode === -32604) {
        return 6; // Already Exists
    } else if (rpcStatusCode === -32605) {
        return 3; // Invalid Argument
    } else if (rpcStatusCode === -32000) {
        return 13; // Internal Server Error
    }

    // http
    else if (rpcStatusCode >= 200 && rpcStatusCode < 300) {
        return 0; // OK
    } else if (rpcStatusCode === 400) {
        return 3; // Invalid Argument
    } else if (rpcStatusCode === 401) {
        return 16; // Unauthenticated
    } else if (rpcStatusCode === 403) {
        return 7; // Permission Denied
    } else if (rpcStatusCode === 404) {
        return 5; // Not Found
    } else if (rpcStatusCode === 409) {
        return 6; // Already Exists
    } else if (rpcStatusCode >= 500 && rpcStatusCode < 600) {
        return 13; // Internal Server Error
    }

    return 13; // Unknown Error
}

function mapToHttpStatusCode(rpcStatusCode: number): number {
    if (rpcStatusCode >= 200 && rpcStatusCode < 600) {
        return rpcStatusCode; // Already an HTTP status code
    }

    // json rpc
    else if (rpcStatusCode === 0) {
        return 200; // OK
    } else if (rpcStatusCode === -32600) {
        return 400; // Invalid Request
    } else if (rpcStatusCode === -32601) {
        return 401; // Unauthorized
    } else if (rpcStatusCode === -32602) {
        return 403; // Forbidden
    } else if (rpcStatusCode === -32603) {
        return 404; // Not Found
    } else if (rpcStatusCode === -32604) {
        return 409; // Conflict
    } else if (rpcStatusCode === -32605) {
        return 422; // Unprocessable Entity
    } else if (rpcStatusCode === -32000) {
        return 500; // Internal Server Error
    }

    // grpc
    else if (rpcStatusCode === 0) {
        return 200; // OK
    } else if (rpcStatusCode === 3) {
        return 400; // Invalid Argument
    } else if (rpcStatusCode === 16) {
        return 401; // Unauthenticated
    } else if (rpcStatusCode === 7) {
        return 403; // Permission Denied
    } else if (rpcStatusCode === 5) {
        return 404; // Not Found
    } else if (rpcStatusCode === 6) {
        return 409; // Already Exists
    } else if (rpcStatusCode === 13) {
        return 500; // Internal Server Error
    }

    return 500; // Unknown Error
}
