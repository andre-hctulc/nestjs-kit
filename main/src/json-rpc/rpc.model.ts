import { z } from "zod";

export const JsonRpcRequestSchema = z.object({
    jsonrpc: z.literal("2.0"),
    method: z.string(),
    params: z.array(z.any()).or(z.record(z.string(), z.unknown())).optional(),
    id: z.string().or(z.number()).nullable().optional(),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

type ID = string | number | null;
type JsonRpcVersion = "2.0";

export interface RpcResponse<T = unknown> {
    jsonrpc: JsonRpcVersion;
    result: T;
    /**
     * ID matching the request ID, or null if the request was a notification.
     */
    id: ID;
}

export interface RpcErrorResponse {
    jsonrpc: JsonRpcVersion;
    error: RpcErrorData;
    /**
     * ID matching the request ID, or null if the request was a notification.
     */
    id: ID;
}

export type RpcResponseInput<T = unknown> = Omit<RpcResponse<T>, "jsonrpc">;
export type RpcErrorResponseInput = Omit<RpcErrorResponse, "jsonrpc">;

export type RpcErrorData = {
    code: number;
    message: string;
    data?: any;
};
