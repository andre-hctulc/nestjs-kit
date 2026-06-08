import { Catch, type ArgumentsHost } from "@nestjs/common";
import { Observable } from "rxjs";
import { GlobalExceptionFilterBase } from "../common/filters/global-exception-filter-base.filter.js";

@Catch()
export class GlobalRpcExceptionFilter extends GlobalExceptionFilterBase<Observable<any>> {
    protected override at(host: ArgumentsHost): string {
        const ctx = host.switchToRpc();
        const pattern = this.#getRpcPattern(ctx.getContext());
        return pattern != null ? `RPC [${pattern}]` : "RPC";
    }

    /** Extracts the message pattern/topic/subject/channel from transport-specific RPC contexts. */
    #getRpcPattern(rpcCtx: unknown): string | undefined {
        if (!rpcCtx || typeof rpcCtx !== "object") return undefined;
        // TCP, RMQ → getPattern()
        if ("getPattern" in rpcCtx && typeof rpcCtx.getPattern === "function") {
            return String(rpcCtx.getPattern());
        }
        // Kafka, MQTT → getTopic()
        if ("getTopic" in rpcCtx && typeof rpcCtx.getTopic === "function") {
            return String(rpcCtx.getTopic());
        }
        // NATS → getSubject()
        if ("getSubject" in rpcCtx && typeof rpcCtx.getSubject === "function") {
            return String(rpcCtx.getSubject());
        }
        // Redis → getChannel()
        if ("getChannel" in rpcCtx && typeof rpcCtx.getChannel === "function") {
            return String(rpcCtx.getChannel());
        }
        return undefined;
    }
}
