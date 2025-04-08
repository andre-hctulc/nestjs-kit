import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { LogLevel } from "../types.js";
import { defaultLogLevel, log } from "../util/system.js";
import { mapException } from "./exceptions.util.js";

export type ErrorBody = {
    message: string;
    details: Record<string, any>;
    statusCode: number;
};

export type ErrorMapper = (exception: unknown) => ErrorBody | HttpException | null | undefined | void;

export interface ExceptionsFilterConfig {
    /**
     * Map known errors to a specific error response.
     */
    mapErrors?: ErrorMapper;
    /**
     * `"unexpected"`: Log all non {@link HttpException} errors.
     *
     * `"all"`: Log all errors.
     *
     * `"none"`: Log no errors.
     *
     * @default "unexpected"
     */
    logLevel?: LogLevel;
}

/**
 * Maps all exceptions to a JSON response ({@link ErrorBody}).
 * {@link HttpException}s are mapped to their status code and message.
 * All other exceptions are mapped to a 500 status code and "Internal server error" message.
 */
@Catch()
export class HttPExceptionsFilter implements ExceptionFilter {
    private _config: ExceptionsFilterConfig;
    private _logLevel: LogLevel;

    constructor(config?: ExceptionsFilterConfig) {
        this._config = config || {};
        this._logLevel = this._config.logLevel || defaultLogLevel();
    }

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();

        const send = (body: ErrorBody) => {
            const route = ctx.getRequest<FastifyRequest>().url;

            log(
                this._logLevel,
                "error",
                `Exception caught at "${route}":\n`,
                exception
            );

            // fastify
            if (typeof res.code === "function") {
                return res.code(status).send(body);
            }
            // express
            else {
                return res.status(status).json(body);
            }
        };

        const errorBody = mapException(exception);

        send(errorBody);
    }
}
