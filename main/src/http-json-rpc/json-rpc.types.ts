import { HttpRpcError } from "./http-rpc.error.js";

type ID = string | number | null;
type JsonRpcVersion = "2.0";

export interface JsonRpcResponse<T = unknown> {
    jsonrpc: JsonRpcVersion;
    result: T;
    /**
     * ID matching the request ID, or null if the request was a notification.
     */
    id: ID;
}

export type JsonRpcResponseInput<T = unknown> = Omit<JsonRpcResponse<T>, "jsonrpc">;

export interface JsonRpcErrorResponse<T = unknown> {
    jsonrpc: JsonRpcVersion;
    error: {
        code: number;
        message: string;
        data?: T;
    };
    /**
     * ID matching the request ID, or null if the request was a notification.
     */
    id: ID;
}

export type JsonRpcErrorResponseInput<T = unknown> = Omit<JsonRpcErrorResponse<T>, "jsonrpc">;
