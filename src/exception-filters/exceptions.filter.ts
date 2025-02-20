import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { FastifyRequest } from "fastify";

export type ErrorBody = {
    message: string;
    details: Record<string, any>;
    statusCode: number;
};

type ErrorLogLevel = "all" | "unexpected" | "none";

interface ExceptionsFilterConfig {
    /**
     * Map errors to an error body or an {@link HttpException}.
     */
    mapErrors?: (exception: unknown) => ErrorBody | HttpException | null | undefined | void;
    /**
     * `"unexpected"`: Log all non {@link HttpException} errors.
     *
     * `"all"`: Log all errors.
     *
     * `"none"`: Log no errors.
     *
     * @default "unexpected"
     */
    logErrors?: ErrorLogLevel;
}

/**
 * Maps all exceptions to a JSON response ({@link ErrorBody}).
 * {@link HttpException}s are mapped to their status code and message.
 * All other exceptions are mapped to a 500 status code and "Internal server error" message.
 */
@Catch()
export class ExceptionsFilter implements ExceptionFilter {
    private _config: ExceptionsFilterConfig;
    private _logErrors: ErrorLogLevel;

    constructor(config?: ExceptionsFilterConfig) {
        this._config = config || {};
        this._logErrors = this._config.logErrors || "unexpected";
    }

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();

        const send = (status: number, body: ErrorBody, log: boolean) => {
            if (log) {
                const route = ctx.getRequest<FastifyRequest>().url;

                console.log(`\n--< nestjs-kit >-- (${status}) Exception caught at "${route}":\n`);
                console.error(exception);
            }

            // fastify
            if (typeof res.code === "function") {
                return res.code(status).send(body);
            }
            // express
            else {
                return res.status(status).json(body);
            }
        };

        const userMapped = this._config.mapErrors?.(exception);

        if (userMapped) {
            if (!(userMapped instanceof HttpException)) {
                send(userMapped.statusCode, userMapped, this._logErrors === "all");
                return;
            } else {
                exception = userMapped;
            }
        }

        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const resObj = exception.getResponse();

            const errBody: ErrorBody = {
                statusCode: status,
                message: exception.message,
                details: {},
            };

            if (typeof resObj === "object") {
                const resObjMessage = (resObj as any)["message"];

                if (typeof resObjMessage === "string") {
                    errBody.message = resObjMessage;
                    delete (resObj as any)["message"];
                }

                errBody.details = resObj;
            }

            send(status, errBody, this._logErrors === "all");
        } else {
            send(
                HttpStatus.INTERNAL_SERVER_ERROR,
                {
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    message: "Internal server error",
                    details: {},
                },
                this._logErrors !== "none"
            );
        }
    }
}
