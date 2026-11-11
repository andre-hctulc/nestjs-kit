import { Module } from "@nestjs/common";
import { UploadParserService } from "./upload-parser.service.js";

@Module({
    providers: [UploadParserService],
})
export class UploadModule {}
