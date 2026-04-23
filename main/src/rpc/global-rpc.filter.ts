import { Catch, type ArgumentsHost } from "@nestjs/common";
import { Observable } from "rxjs";
import { GlobalExceptionFilterBase } from "../common/filters/global-exception-filter-base.filter.js";
import { type CommonErrorObject } from "../common/index.js";

/**
 * Catches all errors and sends them (as received) to the client as an observable error.
 * Use `mapErrors` in the config to map errors to {@link CommonErrorObject} if needed.
 */
@Catch()
export class GlobalRpcExceptionFilter extends GlobalExceptionFilterBase<Observable<any>> {
    protected override at(host: ArgumentsHost): string {
        const ctx = host.switchToRpc();
        const rpcCtx = ctx.getContext();
        return `RPC [${String(rpcCtx.pattern)}]`;
    }
}
