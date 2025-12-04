import type { LogLevel } from "@nestjs/common";

export function defaultLogLevel(): LogLevel {
    if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
        return "debug";
    }
    return "error";
}

const PRE_RED = "\x1b[31m[nestjs-kit]\x1b[0m";
const PRE_BLUE = "\x1b[34m[nestjs-kit]\x1b[0m";
const PRE_YELLOW = "\x1b[33m[nestjs-kit]\x1b[0m";
const PRE_MAGENTA = "\x1b[35m[nestjs-kit]\x1b[0m";
const PRE_GRAY = "\x1b[90m[nestjs-kit]\x1b[0m";

function getPre(level: LogLevel): string {
    switch (level) {
        case "verbose":
        case "log":
            return PRE_BLUE;
        case "debug":
            return PRE_MAGENTA;
        case "warn":
            return PRE_YELLOW;
        case "error":
        case "fatal":
            return PRE_RED;
        default:
            return PRE_GRAY;
    }
}

function shouldLog(checkLevel: LogLevel, activeLevel: LogLevel): boolean {
    // Define log level hierarchy (higher index = more verbose)
    const logLevels: LogLevel[] = ["fatal", "error", "warn", "log", "debug", "verbose"];
    const checkIndex = logLevels.indexOf(checkLevel);
    const activeIndex = logLevels.indexOf(activeLevel);

    // Only log if the severity level is at or below the current log level
    return !(checkIndex === -1 || activeIndex === -1 || activeIndex < checkIndex);
}

/**
 * `checkLevel <= activeLevel` then log the message
 */
export function log(checkLevel: LogLevel, activeLevel: LogLevel, ...message: any[]): void {
    if (!shouldLog(checkLevel, activeLevel)) {
        return;
    }
    console.log(getPre(checkLevel));
    console.log(...message);
}

/**
 * `checkLevel <= activeLevel` then log the message
 */
export function logRaw(checkLevel: LogLevel, activeLevel: LogLevel, ...message: any[]): void {
    if (!shouldLog(checkLevel, activeLevel)) {
        return;
    }
    console.log(...message);
}

export function hasKeys(obj: object): boolean {
    return Object.keys(obj).length > 0;
}

export function isPlainObject(obj: unknown): obj is object {
    return (
        Object.prototype.toString.call(obj) === "[object Object]" &&
        (Object.getPrototypeOf(obj) === Object.prototype || Object.getPrototypeOf(obj) === null)
    );
}
