import { z } from "zod/v4";
import type { ErrorBody } from "../common/index.js";

export const JsonRpcRequestSchema = z.object({
    jsonrpc: z.literal("2.0"),
    method: z.string(),
    params: z.array(z.any()).or(z.record(z.string(), z.unknown())).optional(),
    id: z.string().or(z.number()).nullable().optional(),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

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

export interface JsonRpcErrorResponse {
    jsonrpc: JsonRpcVersion;
    error: ErrorBody;
    /**
     * ID matching the request ID, or null if the request was a notification.
     */
    id: ID;
}

export type JsonRpcErrorResponseInput<T = unknown> = Omit<JsonRpcErrorResponse, "jsonrpc">;
