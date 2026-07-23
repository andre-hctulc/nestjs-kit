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

export function isWritableCall(call: AnyGrpcCall): call is AnyGrpcCall & WritableGrpcCall {
    return typeof (call as any).write === "function" && typeof (call as any).end === "function";
}