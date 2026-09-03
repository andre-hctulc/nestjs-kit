import type { ApiAccess } from "../common/index.js";

declare module "@nestjs/microservices" {
    export interface TcpContext {
        apiAccess?: ApiAccess;
    }
}

export {};
