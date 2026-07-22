import type { ApiAccess } from "../common/index.js";

declare module "@connectrpc/connect" {
    export interface HandlerContext {
        apiAccess: ApiAccess;
    }
}
