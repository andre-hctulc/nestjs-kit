import { z } from "zod/v4";

export const JsonRpcRequestSchema = z.object({
    jsonrpc: z.literal("2.0"),
    method: z.string(),
    params: z.array(z.any()).or(z.record(z.string(), z.unknown())).optional(),
    id: z.string().or(z.number()).nullable().optional(),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;
