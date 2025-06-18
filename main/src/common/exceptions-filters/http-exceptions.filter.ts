import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { mapExceptionWithInfo, mapException } from "./exceptions.util.js";
import { ErrorBody, ErrorMapper } from "./exceptions.types.js";
import { LogLevel } from "../util/types.js";
import { defaultLogLevel, log } from "../util/system/system-util.js";

export interface ExceptionsFilterConfig {
    mapErrors?: ErrorMapper;
    /**
     * "verbose": Log all exceptions
     *
     * "error" | "info": Log only unmapped and non http errors
     */
    logLevel?: LogLevel;
}

/**
 * Maps all exceptions to a JSON response ({@link ErrorBody}).
 *
 * @see {@link ErrorBody} and {@link mapException} for more details.
 */
@Catch()
export class HttpExceptionsFilter implements ExceptionFilter {
    private _config: ExceptionsFilterConfig;
    private _logLevel: LogLevel;

    constructor(config?: ExceptionsFilterConfig) {
        this._config = config || {};
        this._logLevel = this._config.logLevel || defaultLogLevel();
    }

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest<FastifyRequest>();
        const { body: errorBody, userMapped } = mapExceptionWithInfo(exception, this._config.mapErrors);

        const send = (body: ErrorBody) => {
            const route = ctx.getRequest<FastifyRequest>().url;

            // Only log the exception if log mode verbose or if the exception is not a HttpException
            // NOTE log() does'nt log when logLevel is silent
            if (
                (this._logLevel !== "error" && this._logLevel !== "info") ||
                (!(exception instanceof HttpException) && !userMapped)
            ) {
                log(this._logLevel, "error", `[${req.method}] Exception caught at "${route}":\n`, exception);
            }

            // fastify
            if (typeof res.code === "function") {
                return res.code(body.status).send(body);
            }
            // express
            else {
                return res.status(body.status).json(body);
            }
        };

        send(errorBody);
    }
}
