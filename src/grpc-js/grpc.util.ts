import { status } from "@grpc/grpc-js";
import type {
    ServerUnaryCall,
    ServerWritableStream,
    ServerReadableStream,
    ServerDuplexStream,
    sendUnaryData,
} from "@grpc/grpc-js";

export type AnyGrpcCall<Req = unknown, Res = unknown> =
    | ServerUnaryCall<Req, Res>
    | ServerWritableStream<Req, Res>
    | ServerReadableStream<Req, Res>
    | ServerDuplexStream<Req, Res>;

export type AnyGrpcCallback<Res = unknown> = sendUnaryData<Res>;
export type WritableGrpcCall = { write: (chunk: unknown) => void; end: () => void };

export function mapHttpStatus(httpStatusCode: number): status {
    switch (httpStatusCode) {
        case 400:
            return status.INVALID_ARGUMENT;
        case 401:
            return status.UNAUTHENTICATED;
        case 403:
            return status.PERMISSION_DENIED;
        case 404:
            return status.NOT_FOUND;
        case 409:
            return status.ALREADY_EXISTS;
        case 429:
            return status.RESOURCE_EXHAUSTED;
        case 499:
            return status.CANCELLED;
        case 500:
            return status.INTERNAL;
        case 501:
            return status.UNIMPLEMENTED;
        case 503:
            return status.UNAVAILABLE;
        default:
            return status.UNKNOWN;
    }
}

export function isWritableCall(call: AnyGrpcCall): call is AnyGrpcCall & WritableGrpcCall {
    return typeof (call as any).write === "function" && typeof (call as any).end === "function";
}