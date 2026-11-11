import {
    Injectable,
    PayloadTooLargeException,
    UnsupportedMediaTypeException,
    type OnModuleInit,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { errorCodes, type FastifyInstance, type FastifyRequest } from "fastify";
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import type { RawUploadOptions } from "./raw-upload.decorator.js";

/**
 * Enable raw upload parsing for handlers decorated with `@RawUpload`.
 */
@Injectable()
export class UploadParserService implements OnModuleInit {
    #fastify: FastifyInstance;

    // Register before Nest installs routes; onModuleInit runs too late for onRoute.
    constructor(adapterHost: HttpAdapterHost) {
        const fastify = adapterHost.httpAdapter.getInstance<FastifyInstance>();
        this.#fastify = fastify;
        fastify.addHook("onRoute", (route) => {
            if (route.config?.rawUpload) {
                route.bodyLimit = route.config.rawUpload.maxSize;
            }
        });
    }

    onModuleInit(): void {
        const fastify = this.#fastify;

        // JSON and text uploads must bypass parsing too, so dispatch by route before reading.
        fastify.removeContentTypeParser(["application/json", "text/plain"]);

        // replace default content type parser with custom one to handle raw uploads and preserve existing behavior for JSON and text
        fastify.addContentTypeParser(
            ["application/json", "text/plain", "*"],
            async (
                request: FastifyRequest,
                payload: IncomingMessage & { receivedEncodedLength?: number },
            ) => {
                const contentLength = Number(request.headers["content-length"]);

                const upload = request.routeOptions.config.rawUpload;
                if (upload) {
                    return this.#stream(payload, contentLength, upload);
                }

                return this.#textOrJson(request, payload, contentLength);
            },
        );
    }

    #stream(
        payload: IncomingMessage & { receivedEncodedLength?: number },
        contentLength: number,
        upload: RawUploadOptions,
    ) {
        if (contentLength > upload.maxSize) {
            throw new PayloadTooLargeException();
        }
        const stream = Readable.from(
            (async function* () {
                let size = 0;
                try {
                    for await (const chunk of payload.iterator({ destroyOnReturn: false })) {
                        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                        size += bytes.length;
                        if (size > upload.maxSize || (payload.receivedEncodedLength ?? 0) > upload.maxSize) {
                            throw new PayloadTooLargeException();
                        }
                        yield bytes;
                    }
                    if (
                        !Number.isNaN(contentLength) &&
                        (payload.receivedEncodedLength || size) !== contentLength
                    ) {
                        throw new errorCodes.FST_ERR_CTP_INVALID_CONTENT_LENGTH();
                    }
                } finally {
                    if (!payload.readableEnded) {
                        payload.pause();
                    }
                }
            })(),
            { objectMode: false },
        );
        return stream;
    }

    async #textOrJson(
        request: FastifyRequest,
        payload: IncomingMessage & { receivedEncodedLength?: number },
        contentLength: number,
    ) {
        const fastify = this.#fastify;

        const jsonParser = fastify.getDefaultJsonParser("error", "error");

        const contentType = request.headers["content-type"]?.split(";")[0].trim().toLowerCase();
        if (contentType !== "application/json" && contentType !== "text/plain") {
            throw new UnsupportedMediaTypeException();
        }

        const limit = request.routeOptions.bodyLimit;
        if (contentLength > limit) {
            throw new errorCodes.FST_ERR_CTP_BODY_TOO_LARGE();
        }

        // Collect chunks from payload
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of payload.iterator({ destroyOnReturn: false })) {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += bytes.length;
            if (size > limit || (payload.receivedEncodedLength ?? 0) > limit) {
                throw new errorCodes.FST_ERR_CTP_BODY_TOO_LARGE();
            }
            chunks.push(bytes);
        }

        if (!Number.isNaN(contentLength) && (payload.receivedEncodedLength || size) !== contentLength) {
            throw new errorCodes.FST_ERR_CTP_INVALID_CONTENT_LENGTH();
        }

        const body = Buffer.concat(chunks).toString("utf8");

        // text/plain
        if (contentType === "text/plain") {
            return body;
        }

        // application/json
        return new Promise<unknown>((resolve, reject) => {
            jsonParser(request, body, (error, value) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(value);
            });
        });
    }
}
