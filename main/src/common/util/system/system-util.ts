import { LogLevel } from "../types.js";

export function defaultLogLevel(): LogLevel {
    if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
        return "verbose";
    }
    return "error";
}

const PRE = "--<< nestjs-kit >>--";

export function log(currentLogLevel: LogLevel, severity: Omit<LogLevel, "silent">, ...message: any[]): void {
    if (currentLogLevel === "silent") {
        return;
    }

    const logger = severity === "error" ? console.error : console.log;

    if (currentLogLevel === "verbose") {
        return logger(PRE, ...message);
    }

    if (currentLogLevel === "info" && severity === "error") {
        return;
    }

    logger(PRE, "\n", ...message);
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
