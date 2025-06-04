import { Module } from "@nestjs/common";
import { OpenIDClientCService } from "./oidc-client.service.js";

@Module({
    providers: [],
    exports: [],
})
export class OAuthModule {}
