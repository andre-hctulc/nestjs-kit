import { Module } from "@nestjs/common";
import { InputLoaderService } from "../services/input-loader.service.js";

@Module({
    providers: [InputLoaderService],
    exports: [InputLoaderService],
})
export class CommonModule {}
