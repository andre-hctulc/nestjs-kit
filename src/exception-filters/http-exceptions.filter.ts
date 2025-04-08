import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { LogLevel } from "../types.js";
import { defaultLogLevel, log } from "../util/system.js";
import { mapException } from "./exceptions.util.js";
import { ErrorBody, ErrorMapper } from "./exceptions.types.js";

export interface ExceptionsFilterConfig {
    mapErrors?: ErrorMapper;
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

        const send = (body: ErrorBody) => {
            const route = ctx.getRequest<FastifyRequest>().url;

            log(this._logLevel, "error", `Exception caught at "${route}":\n`, exception);

            // fastify
            if (typeof res.code === "function") {
                return res.code(body.status).send(body);
            }
            // express
            else {
                return res.status(body.status).json(body);
            }
        };

        const errorBody = mapException(exception, this._config.mapErrors);

        send(errorBody);
    }
}
