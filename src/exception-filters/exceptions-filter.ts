import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";

export type ErrorBody = {
    message: string;
    details: Record<string, any>;
    statusCode: number;
};

interface ExceptionsFilterConfig {
    /**
     * Map an exception to an error body or an {@link HttpException}.
     */
    mapException?: (exception: unknown) => ErrorBody | HttpException | null | undefined | void;
}

/**
 * Maps all exceptions to a JSON response ({@link ErrorBody}).
 */
@Catch()
export class ExceptionsFilter implements ExceptionFilter {
    private _config: ExceptionsFilterConfig;

    constructor(config?: ExceptionsFilterConfig) {
        this._config = config || {};
    }

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();

        const userMapped = this._config.mapException?.(exception);

        if (userMapped) {
            if (!(userMapped instanceof HttpException)) {
                response.status(userMapped.statusCode).json(userMapped);
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

            response.status(status).json(errBody);
        } else {
            response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                message: "Internal server error",
                details: {},
            });
        }
    }
}
