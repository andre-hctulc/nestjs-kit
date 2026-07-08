import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from "@nestjs/common";
import { ZodError } from "zod";
import { getErrorLocationDescription, sendError, type ErrorShape } from "../common/index.js";
import type { ZPipe } from "./zod.pipe.js";
import { ZPipeError } from "./zod-pipe.error.js";

/**
 * Zod exception filter that exclusively handles {@link ZPipeError}s thrown by {@link ZPipe}s.
 */
@Catch(ZPipeError)
export class ZPipeExceptionFilter implements ExceptionFilter {
    #logger = new Logger(this.constructor.name);

    async catch(exception: ZodError, host: ArgumentsHost) {
        const errObj: ErrorShape = {
            message: "Param validation failed",
            details: {
                issues: exception.issues,
            },
            code: "PARAM_VALIDATION_FAILED",
        };

        const at = getErrorLocationDescription(host);
        this.#logger.debug(`Param validation failed at ${at}`, exception);

        return await sendError(host, errObj, exception);
    }
}
