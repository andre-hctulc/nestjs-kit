import { Module } from "@nestjs/common";
import { UploadParserService } from "./upload-parser.service.js";

/**
 * Upload module for handling file uploads.
 */
@Module({
    providers: [UploadParserService],
})
export class UploadModule {}
