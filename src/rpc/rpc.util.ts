import type { RpcResponse, RpcResponseInput, RpcErrorResponse, RpcErrorResponseInput } from "./rpc.model.js";
import type { Metadata } from "@grpc/grpc-js";

/**
 * Create a JSON-RPC response object.
 */
export function createRpcResponse<T>(data: RpcResponseInput<T>): RpcResponse<T> {
    return {
        jsonrpc: "2.0",
        result: data.result,
        id: data.id ?? null,
    };
}

/**
 * Create a JSON-RPC error response object.
 */
export function createRpcErrorResponse(data: RpcErrorResponseInput): RpcErrorResponse {
    return {
        jsonrpc: "2.0",
        error: data.error,
        id: data.id ?? null,
    };
}

export async function assertGrpcContext(context: unknown): Promise<Metadata> {
    const { Metadata } = await import("@grpc/grpc-js");
    if (!(context instanceof Metadata)) {
        throw new Error("Not a grpc Metadata context");
    }
    return context;
}
