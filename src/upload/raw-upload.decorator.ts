import { RouteConfig } from "@nestjs/platform-fastify";

export interface RawUploadOptions {
    maxSize: number;
}

declare module "fastify" {
    interface FastifyContextConfig {
        rawUpload?: RawUploadOptions;
    }
}

function checkOptions(options: RawUploadOptions): void {
    if (!Number.isSafeInteger(options.maxSize) || options.maxSize < 0) {
        throw new RangeError("Raw upload maxSize must be a non-negative safe integer");
    }
}

/**
 * Expose the raw request body as a size-limited Readable through @Body().
 * Requires UploadModule; consume the stream or explicitly abandon it with destroy().
 * Propagate consumption errors. The package owns HTTP transport cleanup.
 */
export function RawUpload(options: RawUploadOptions): MethodDecorator {
    checkOptions(options);
    return RouteConfig({ rawUpload: { ...options } });
}
