import type { MsPattern } from "@nestjs/microservices";
import type { ConnectMsPattern } from "./connect-rpc.server.js";
import { decapitalize } from "../common/util/system/system.util.js";

function parseTimeoutMs(value: string): number | undefined {
    const match = /^(\d+)([HMSmun])$/.exec(value.trim());
    if (!match) {
        return undefined;
    }

    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount < 0) {
        return undefined;
    }

    switch (match[2]) {
        case "H":
            return amount * 60 * 60 * 1000;
        case "M":
            return amount * 60 * 1000;
        case "S":
            return amount * 1000;
        case "m":
            return amount;
        case "u":
            return Math.ceil(amount / 1000);
        case "n":
            return Math.ceil(amount / 1_000_000);
        default:
            return undefined;
    }
}

const CONNECT_TIMEOUT_HEADER = "Connect-Timeout-Ms";
const GRPC_TIMEOUT_HEADER = "Grpc-Timeout";

export function getConnectClientDeadline(headers: Headers): Date | undefined {
    const connectTimeoutValue = headers.get(CONNECT_TIMEOUT_HEADER);
    if (connectTimeoutValue) {
        const timeoutMs = Number(connectTimeoutValue);
        if (Number.isFinite(timeoutMs) && timeoutMs >= 0) {
            return new Date(Date.now() + timeoutMs);
        }
    }

    const grpcTimeoutValue = headers.get(GRPC_TIMEOUT_HEADER);
    if (!grpcTimeoutValue) {
        return undefined;
    }

    const timeoutMs = parseTimeoutMs(grpcTimeoutValue);
    if (timeoutMs === undefined) {
        return undefined;
    }

    return new Date(Date.now() + timeoutMs);
}

export function normalizeConnectPattern(pattern: MsPattern): ConnectMsPattern {
    let obj: any;
    if (typeof pattern === "string") {
        if (pattern.startsWith("{")) {
            try {
                const parsed = JSON.parse(pattern);
                if (typeof parsed === "object" && parsed !== null && "method" in parsed) {
                    obj = parsed;
                } else {
                    throw new Error("Invalid connect pattern string");
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
