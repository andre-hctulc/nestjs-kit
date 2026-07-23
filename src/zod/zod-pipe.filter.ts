import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from "@nestjs/common";
import { getErrorLocationDescription, sendError, type ErrorShape } from "../common/index.js";
import type { ZPipe } from "./zod.pipe.js";
import { ZPipeError } from "./zod-pipe.error.js";

/**
 * Zod exception filter that exclusively handles {@link ZPipeError}s thrown by {@link ZPipe}s.
 */
@Catch(ZPipeError)
export class ZPipeExceptionFilter implements ExceptionFilter {
    #logger = new Logger(this.constructor.name);

    async catch(exception: ZPipeError, host: ArgumentsHost) {
        const errObj: ErrorShape = {
            message: exception.message,
            details: exception.details,
            errorCode: exception.errorCode,
            statusCode: exception.statusCode,
        };

        const at = getErrorLocationDescription(host);
        this.#logger.debug(`Validation error at ${at}`, exception);

        return await sendError(host, errObj, errObj.statusCode);
    }
}
