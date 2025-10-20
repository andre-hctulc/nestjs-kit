import { Catch, type ArgumentsHost, type RpcExceptionFilter } from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import {
    GlobalExceptionFilterBase,
    type GlobalExceptionFilterConfig,
} from "../common/filters/global-exception-filter-base.filter.js";
import type { CommonErrorObject } from "../common/index.js";

export interface GlobalRpcExceptionFilterConfig extends GlobalExceptionFilterConfig {}

/**
 * Catches all errors and sends them (as received) to the client as an observable error.
 * Use `mapErrors` in the config to map errors to {@link CommonErrorObject} if needed.
 */
@Catch()
export class GlobalRpcExceptionFilter
    extends GlobalExceptionFilterBase<Observable<any>>
    implements RpcExceptionFilter
{
    #config: GlobalRpcExceptionFilterConfig;

    constructor(config: GlobalRpcExceptionFilterConfig = {}) {
        super(config);
        this.#config = config || {};
    }

    protected override sendError(
        exception: unknown,
        error: CommonErrorObject,
        host: ArgumentsHost
    ): Observable<any> {
        return throwError(() => exception);
    }

    protected override at(host: ArgumentsHost): string {
        const ctx = host.switchToRpc();
        const rpcCtx = ctx.getContext();
        return `RPC [${String(rpcCtx.pattern)}]`;
    }
}
