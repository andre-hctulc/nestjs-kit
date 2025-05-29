/**
 * `verbose ` - Log everything
 *
 * `info` - Conservative logging
 *
 * `error` - Only log errors
 *
 * `silent` - Disable logs
 */
export type LogLevel = "verbose" | "info" | "error" | "silent";

export type RawParams = Record<string, string | string[]>;
