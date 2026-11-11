import {
    BadRequestException,
    Body,
    Controller,
    InternalServerErrorException,
    Post,
    Req,
    UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Readable } from "node:stream";
import { RawUpload } from "../../../src/upload/index.js";
import { RejectGuard } from "./reject.guard.js";
import { UploadTestService } from "./upload-test.service.js";

@Controller()
export class UploadController {
    constructor(private readonly state: UploadTestService) {}

    @Post("upload")
    @RawUpload({ maxSize: 8 })
    async upload(@Body() file: Readable, @Req() request?: FastifyRequest) {
        this.state.observedStream = file;
        this.state.observedRequest = request;
        let size = 0;
        try {
            for await (const chunk of file) {
                size += chunk.length;
            }
            return { size };
        } finally {
            file.destroy();
        }
    }

    @Post("empty")
    @RawUpload({ maxSize: 0 })
    empty(@Body() file: Readable) {
        return this.upload(file);
    }

    @Post("progress")
    @RawUpload({ maxSize: 8 })
    async progress(@Body() file: Readable) {
        let size = 0;
        try {
            for await (const chunk of file) {
                size += chunk.length;
                this.state.consumerStarted?.();
            }
            return { size };
        } finally {
            file.destroy();
        }
    }

    @Post("backpressure")
    @RawUpload({ maxSize: 2 * 1024 * 1024 })
    async backpressure(@Body() file: Readable, @Req() request: FastifyRequest) {
        this.state.observedStream = file;
        this.state.observedRequest = request;
        await new Promise<void>((resolve) => {
            this.state.releaseUpload = resolve;
            file.once("readable", () => this.state.consumerStarted?.());
        });
        let size = 0;
        try {
            for await (const chunk of file) size += chunk.length;
            return { size };
        } finally {
            file.destroy();
        }
    }

    @Post("validation")
    @RawUpload({ maxSize: 8 })
    validation() {
        throw new Error("validation should prevent handler execution");
    }

    @Post("guard")
    @RawUpload({ maxSize: 8 })
    @UseGuards(RejectGuard)
    guard() {
        throw new Error("guard should prevent handler execution");
    }

    @Post("reject")
    @RawUpload({ maxSize: 8 })
    reject() {
        throw new BadRequestException("controller rejected");
    }

    @Post("abandon")
    @RawUpload({ maxSize: 8 })
    abandon(@Body() file: Readable, @Req() request: FastifyRequest) {
        this.state.observedStream = file;
        this.state.observedRequest = request;
        return { accepted: false };
    }

    @Post("partial")
    @RawUpload({ maxSize: 8 })
    async partial(@Body() file: Readable) {
        try {
            for await (const _chunk of file) {
                throw new InternalServerErrorException("storage failed");
            }
        } finally {
            file.destroy();
        }
    }

    @Post("destroy")
    @RawUpload({ maxSize: 8 })
    destroy(@Body() file: Readable) {
        this.state.observedStream = file;
        file.destroy();
        throw new BadRequestException("abandoned");
    }

    @Post("destroy-active")
    @RawUpload({ maxSize: 8 })
    async destroyActive(@Body() file: Readable) {
        this.state.observedStream = file;
        const iterator = file[Symbol.asyncIterator]();
        await iterator.next();
        const pending = iterator.next();
        file.destroy();
        try {
            await pending;
        } catch (error) {
            if (typeof error !== "object" || error === null ||
                !("code" in error) || error.code !== "ERR_STREAM_PREMATURE_CLOSE") {
                throw error;
            }
            throw new BadRequestException("abandoned active stream");
        }
        throw new Error("destroy should reject the pending read");
    }

    @Post("disconnect")
    @RawUpload({ maxSize: 8 })
    async disconnect(@Body() file: Readable) {
        this.state.observedStream = file;
        try {
            for await (const _chunk of file) {
                this.state.consumerStarted?.();
            }
            throw new Error("disconnect unexpectedly ended normally");
        } catch (error) {
            this.state.disconnected?.();
            throw error;
        } finally {
            file.destroy();
        }
    }

    @Post("ordinary")
    ordinary(@Body() body: unknown) {
        return { body };
    }
}
