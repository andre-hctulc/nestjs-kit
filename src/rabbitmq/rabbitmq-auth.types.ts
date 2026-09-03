import type { ApiAccess } from "../common/index.js";

declare module "amqplib" {
    export interface ConsumeMessage {
        apiAccess?: ApiAccess;
    }
}

export {};
