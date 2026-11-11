import { Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { Readable } from "node:stream";

@Injectable()
export class UploadTestService {
    disconnected: (() => void) | undefined;
    consumerStarted: (() => void) | undefined;
    observedStream: Readable | undefined;
    observedRequest: FastifyRequest | undefined;
    releaseUpload: (() => void) | undefined;
    readonly listenerCounts = new WeakMap<FastifyRequest, number[]>();
}
