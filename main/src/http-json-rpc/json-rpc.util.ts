import {
    JsonRpcErrorResponse,
    JsonRpcErrorResponseInput,
    JsonRpcResponse,
    JsonRpcResponseInput,
} from "./json-rpc.model.js";

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
export function jsonRcpErr<T>(data: JsonRpcErrorResponseInput<T>): JsonRpcErrorResponse {
    return {
        jsonrpc: "2.0",
        error: data.error,
        id: data.id ?? null,
    };
}
