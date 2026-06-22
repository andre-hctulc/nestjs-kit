import { Module } from "@nestjs/common";
import { InputLoaderService } from "../services/input-loader.service.js";
import { ContentTypeInterceptor } from "../content-types/content-type.interceptor.js";

@Module({
    providers: [InputLoaderService, ContentTypeInterceptor],
    exports: [InputLoaderService, ContentTypeInterceptor],
})
export class CommonModule {}
