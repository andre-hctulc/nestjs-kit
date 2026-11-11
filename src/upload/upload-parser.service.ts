import {
    Injectable,
    PayloadTooLargeException,
    UnsupportedMediaTypeException,
    type OnModuleInit,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { errorCodes, type FastifyInstance, type FastifyRequest } from "fastify";
import type { IncomingMessage } from "node:http";
import { Transform, type Readable } from "node:stream";
import type { RawUploadOptions } from "./raw-upload.decorator.js";

/**
 * Enable raw upload parsing for handlers decorated with `@RawUpload`.
 */
@Injectable()
export class UploadParserService implements OnModuleInit {
    #fastify: FastifyInstance;
    #uploads = new WeakMap<FastifyRequest, { payload: Readable; stream: Readable; cleanup: () => void }>();

    // Register before Nest installs routes; onModuleInit runs too late for onRoute.
    constructor(adapterHost: HttpAdapterHost) {
        const fastify = adapterHost.httpAdapter.getInstance<FastifyInstance>();
        this.#fastify = fastify;
        fastify.addHook("onRoute", (route) => {
            if (route.config?.rawUpload) {
                route.bodyLimit = route.config.rawUpload.maxSize;
            }
        });
        fastify.addHook("onRequest", (request, reply, done) => {
            if (request.routeOptions.config.rawUpload) {
                reply.raw.once("close", () => this.#uploads.get(request)?.cleanup());
            }
            done();
        });
        fastify.addHook("preValidation", async (request) => {
            const upload = request.routeOptions.config.rawUpload;
            // Fastify skips content-type parsing for an empty request without Content-Type.
            if (upload && request.body === undefined) {
                request.body = this.#stream(request, request.raw, Number(request.headers["content-length"]), upload);
            }
        });
        fastify.addHook("onSend", (request, reply, body, done) => {
            if (request.routeOptions.config.rawUpload) {
                const upload = this.#uploads.get(request);
                if (!request.raw.readableEnded || (upload && !upload.payload.readableEnded)) {
                    // Node closes after flushing the response; destroying the socket here loses errors.
                    reply.header("connection", "close");
                    reply.raw.shouldKeepAlive = false;
                }
                upload?.stream.destroy();
            }
            done(null, body);
        });
    }

    onModuleInit(): void {
        const fastify = this.#fastify;

        // JSON and text uploads must bypass parsing too, so dispatch by route before reading.
        fastify.removeContentTypeParser(["application/json", "text/plain"]);

        // replace default content type parser with custom one to handle raw uploads and preserve existing behavior for JSON and text
        fastify.addContentTypeParser(
            ["application/json", "text/plain", "*"],
            async (request: FastifyRequest, payload: IncomingMessage & { receivedEncodedLength?: number }) => {
                const contentLength = Number(request.headers["content-length"]);

                const upload = request.routeOptions.config.rawUpload;
                if (upload) {
                    return this.#stream(request, payload, contentLength, upload);
                }

                return this.#textOrJson(request, payload, contentLength);
            },
        );
    }

    #stream(
        request: FastifyRequest,
        payload: IncomingMessage & { receivedEncodedLength?: number },
        contentLength: number,
        upload: RawUploadOptions,
    ) {
        if (contentLength > upload.maxSize) {
            throw new PayloadTooLargeException();
        }
        let size = 0;
        const stream = new Transform({
            transform(chunk: Buffer, _encoding, done) {
                size += chunk.length;
                if (size > upload.maxSize || (payload.receivedEncodedLength ?? 0) > upload.maxSize) {
                    done(new PayloadTooLargeException());
                    return;
                }
                done(null, chunk);
            },
            flush(done) {
                if ((payload.receivedEncodedLength ?? 0) > upload.maxSize) {
                    done(new PayloadTooLargeException());
                    return;
                }
                if (!Number.isNaN(contentLength) && (payload.receivedEncodedLength || size) !== contentLength) {
                    done(new errorCodes.FST_ERR_CTP_INVALID_CONTENT_LENGTH());
                    return;
                }
                done();
            },
            destroy(error, done) {
                payload.unpipe(stream);
                if (!payload.readableEnded) {
                    payload.pause();
                }
                done(error);
            },
        });
        // A guard may reject before anyone subscribes. Active consumers still receive the stored error.
        stream.on("error", () => {});

        const onError = (error: Error) => stream.destroy(error);
        const onAbort = () => stream.destroy(new Error("Raw upload request aborted"));
        const onPayloadClose = () => {
            if (!payload.readableEnded) {
                stream.destroy(new Error("Raw upload payload closed prematurely"));
            }
        };
        const cleanup = () => {
            payload.removeListener("error", onError);
            payload.removeListener("close", onPayloadClose);
            request.raw.removeListener("aborted", onAbort);
            request.raw.removeListener("error", onError);
            this.#uploads.delete(request);
            stream.destroy();
        };
        payload.on("error", onError);
        payload.on("close", onPayloadClose);
        request.raw.on("aborted", onAbort);
        if (payload !== request.raw) {
            request.raw.on("error", onError);
        }
        this.#uploads.set(request, { payload, stream, cleanup });
        if (request.raw.aborted || payload.destroyed) {
            onAbort();
        } else {
            payload.pipe(stream);
        }
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
