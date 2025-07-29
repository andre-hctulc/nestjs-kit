import {
    JsonRpcErrorResponse,
    JsonRpcErrorResponseInput,
    JsonRpcResponse,
    JsonRpcResponseInput,
} from "./json-rpc.types.js";

/**
 * Create a JSON-RPC response object.
 */
export function jsonRcpRes<T>(data: JsonRpcResponseInput<T>): JsonRpcResponse<T> {
    return {
        jsonrpc: "2.0",
        result: data.result,
        id: data.id ?? null,
    };
}

/**
 * Create a JSON-RPC error response object.
 */
export function jsonRcpErr<T>(data: JsonRpcErrorResponseInput<T>): JsonRpcErrorResponse<T> {
    return {
        jsonrpc: "2.0",
        error: {
            code: data.error.code,
            message: data.error.message,
            data: data.error.data ?? undefined,
        },
        id: data.id ?? null,
    };
}
