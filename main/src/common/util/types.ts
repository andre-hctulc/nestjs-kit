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

export type ParamValue<T = string> = T | T[] | undefined;
export type RawParams<T = string> = Record<string, ParamValue<T>>;
