import { RpcException } from "@nestjs/microservices";
import type { RpcErrorData } from "./rpc.model.js";

export class RpcInvalidParamsError extends RpcException {
    constructor(message?: string) {
        super({ message: message || "Invalid params", code: -32602 } satisfies RpcErrorData);
    }
}

export class RpcNotFoundError extends RpcException {
    constructor(message?: string) {
        super({ message: message || "Not found", code: -32000 } satisfies RpcErrorData);
    }
}

export class RpcBadRequestError extends RpcException {
    constructor(message?: string) {
        super({ message: message || "Bad request", code: -32000 } satisfies RpcErrorData);
    }
}

export class RpcInternalError extends RpcException {
    constructor(message?: string) {
        super({ message: message || "Internal error", code: -32603 } satisfies RpcErrorData);
    }
}

export class RpcForbiddenError extends RpcException {
    constructor(message?: string) {
        super({ message: message || "Access denied", code: -32001 } satisfies RpcErrorData);
    }
}
