import { HttpException } from "@nestjs/common";
import { jsonRcpErr } from "./json-rpc.util.js";
import { JsonRpcErrorResponse } from "./json-rpc.model.js";

export class HttpRpcError<T = unknown> extends HttpException {
    constructor(readonly code: number, readonly message: string, readonly details?: T, httpStatus?: number) {
        super(message, httpStatus ?? 200);
    }

    createRpcErrorResponse(id: string): JsonRpcErrorResponse {
        return jsonRcpErr({
            error: {
                status: this.code,
                message: this.message,
                details: this.details || {},
            },
            id,
        });
    }
}
