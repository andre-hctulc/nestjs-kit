import type {
    ServerUnaryCall,
    ServerWritableStream,
    ServerReadableStream,
    ServerDuplexStream,
    sendUnaryData,
} from "@grpc/grpc-js";
import type { GrpcJsMethodPattern } from "./grpc-js.server.js";
import type { MsPattern } from "@nestjs/microservices";
import { decapitalize } from "../common/util/system/system.util.js";

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

export function normalizeGrpcPattern(pattern: MsPattern): GrpcJsMethodPattern {
    let obj: any;
    if (typeof pattern === "string") {
        if (pattern.startsWith("{")) {
            try {
                const parsed = JSON.parse(pattern);
                if (typeof parsed === "object" && parsed !== null && "method" in parsed) {
                    obj = parsed;
                } else {
                    throw new Error("Invalid gRPC pattern string");
                }
            } catch {
                obj = { method: pattern };
            }
        } else {
            obj = { method: pattern };
        }
    } else if (typeof pattern === "object" && pattern !== null && "method" in pattern) {
        obj = pattern;
    }

    return {
        method: decapitalize(String(obj.method)),
        service: obj.service ? String(obj.service) : undefined,
    };
}
