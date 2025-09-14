import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { mapExceptionWithInfo, mapException } from "./exceptions.util.js";
import { ErrorBody, ErrorMapper, ErrorResponseEnhance } from "./exceptions.types.js";
import { LogLevel } from "../util/types.js";
import { defaultLogLevel, log } from "../util/system/system-util.js";

export interface HttpExceptionFilterConfig {
    mapErrors?: ErrorMapper;
    enhanceResponse?: ErrorResponseEnhance;
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
export class HttpExceptionFilter implements ExceptionFilter {
    private _config: HttpExceptionFilterConfig;
    private _logLevel: LogLevel;

    constructor(config?: HttpExceptionFilterConfig) {
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

            const isUnexpectedError = !(exception instanceof HttpException) || exception.getStatus() >= 500;
            log(
                this._logLevel,
                isUnexpectedError ? "verbose" : "error",
                `ERR at [${req.method}] ${route}:\n`,
                exception
            );

            const { headers } = this._config.enhanceResponse
                ? this._config.enhanceResponse(req, res, exception)
                : { headers: {} };

            Object.entries(headers).forEach(([key, value]) => {
                if (value !== undefined) {
                    res.setHeader(key, value);
                }
            });

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
