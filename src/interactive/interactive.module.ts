import { Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { CommanderService } from "./commander.service.js";

@Module({
    imports: [DiscoveryModule],
    providers: [CommanderService],
    exports: [CommanderService],
})
export class InteractiveModule {}
