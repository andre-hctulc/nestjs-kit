import { RpcResponse, RpcResponseInput, RpcErrorResponse, RpcErrorResponseInput } from "./rpc.model.js";

/**
 * Create a JSON-RPC response object.
 */
export function rpcRes<T>(data: RpcResponseInput<T>): RpcResponse<T> {
    return {
        jsonrpc: "2.0",
        result: data.result,
        id: data.id ?? null,
    };
}

/**
 * Create a JSON-RPC error response object.
 */
export function rpcErr(data: RpcErrorResponseInput): RpcErrorResponse {
    return {
        jsonrpc: "2.0",
        error: data.error,
        id: data.id ?? null,
    };
}

export function isRpcException(err: any): err is { response: any } {
    return err && typeof err === "object" && "response" in err;
}
