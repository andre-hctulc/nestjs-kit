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
 * Requires UploadModule; the handler must consume the stream and propagate errors.
 */
export function RawUpload(options: RawUploadOptions): MethodDecorator {
    checkOptions(options);
    return RouteConfig({ rawUpload: { ...options } });
}
