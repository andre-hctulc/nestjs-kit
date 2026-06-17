import type { LogLevel } from "@nestjs/common";
import { DEV_MODE } from "./system/system.util.js";

export function parseLogLevel(logLevel?: LogLevel): LogLevel[] {
    const input = logLevel || process.env.LOG_LEVEL || (DEV_MODE ? "debug" : "info");
    switch (input.toLowerCase()) {
        case "all":
        case "verbose":
            return ["error", "warn", "log", "debug", "fatal", "verbose"];
        case "debug":
            return ["error", "warn", "log", "debug", "fatal"];
        case "warn":
            return ["error", "warn", "fatal"];
        case "error":
            return ["error", "fatal"];
        case "fatal":
            return ["fatal"];
        case "none":
        case "no":
        case "off":
        case "silent":
            return [];
        case "info":
        default:
            return ["error", "warn", "log", "fatal"];
    }
}
