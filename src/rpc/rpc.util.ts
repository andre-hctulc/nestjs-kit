import type { RpcResponse, RpcResponseInput, RpcErrorResponse, RpcErrorResponseInput } from "./rpc.model.js";
import type { Metadata } from "@grpc/grpc-js";
import type { HandlerContext } from "@connectrpc/connect";
import type { ConsumeMessage } from "amqplib";

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

export function isGrpcContext(context: unknown): context is Metadata {
    return (
        typeof (context as Metadata).add === "function" &&
        typeof (context as Metadata).get === "function" &&
        typeof (context as Metadata).getMap === "function"
    );
}

export function assertGrpcContext(context: unknown): Metadata {
    if (!isGrpcContext(context)) {
        throw new Error("Not a grpc Metadata context");
    }
    return context as Metadata;
}

export function isConnectContext(context: unknown): context is HandlerContext {
    return (
        (context as HandlerContext)?.requestHeader instanceof Headers &&
        (context as HandlerContext)?.service &&
        typeof (context as HandlerContext)?.service === "object"
    );
}

export function assertConnectContext(context: unknown): HandlerContext {
    if (!isConnectContext(context)) {
        throw new Error("Not a connect rpc HandlerContext");
    }
    return context as HandlerContext;
}

export function isRabbitContext(context: unknown): context is ConsumeMessage {
    return (
        !!context &&
        typeof (context as ConsumeMessage).content === "object" &&
        typeof (context as ConsumeMessage).fields === "object" &&
        typeof (context as ConsumeMessage).properties === "object"
    );
}

export function assertRabbitContext(context: unknown): ConsumeMessage {
    if (!isRabbitContext(context)) {
        throw new Error("Not a RabbitMQ ConsumeMessage context");
    }
    return context as ConsumeMessage;
}
