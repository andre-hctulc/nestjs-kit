import { HttpException } from "@nestjs/common";
import { JsonRpcErrorResponse } from "./json-rpc.types.js";
import { jsonRcpErr } from "./json-rpc.util.js";

export class JsonRpcError<T = unknown> extends HttpException {
    constructor(readonly code: number, readonly message: string, readonly data?: T, httpStatus?: number) {
        super(message, httpStatus || 200);
    }

    createRpcErrorResponse(id: string): JsonRpcErrorResponse<T> {
        return jsonRcpErr({
            error: {
                code: this.code,
                message: this.message,
                data: this.data,
            },
            id,
        });
    }
}
