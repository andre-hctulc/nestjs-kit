import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";

export type ErrorBody = {
    message: string;
    details: Record<string, any>;
    statusCode: number;
};

/**
 * Maps all exceptions to a JSON response ({@link ErrorBody}).
 */
@Catch()
export class ExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();

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
