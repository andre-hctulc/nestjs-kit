import type { LogLevel } from "@nestjs/common";

export function defaultLogLevel(): LogLevel {
    if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
        return "debug";
    }
    return "error";
}

const PRE = "--<< nestjs-kit >>--";

/**
 * `checkLevel <= activeLevel` then log the message
 */
export function log(checkLevel: LogLevel, activeLevel: LogLevel, ...message: any[]): void {
    // Define log level hierarchy (higher index = more verbose)
    const logLevels: LogLevel[] = ["fatal", "error", "warn", "log", "debug", "verbose"];
    const checkIndex = logLevels.indexOf(checkLevel);
    const activeIndex = logLevels.indexOf(activeLevel);

    // Only log if the severity level is at or below the current log level
    if (checkIndex === -1 || activeIndex === -1 || activeIndex < checkIndex) {
        return;
    }

    const _log = activeLevel === "error" || activeLevel === "fatal" ? console.error : console.log;
    _log(PRE, "\n", ...message);
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
