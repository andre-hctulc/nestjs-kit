import type { ApiAccess } from "../common/index.js";

/**
 * @example
 * const metadata = context.switchToRpc().getContext<Metadata>();
 * metadata[GRPC_AUTHENTICATION_SYMBOL] = { userId: 123 };
 */
export const GRPC_AUTHENTICATION_SYMBOL = Symbol("rpcAuthenticationContext");

interface GrpcAuthenticationContext {
    apiAccess: ApiAccess;
    [key: string]: any;
}

declare module "@grpc/grpc-js" {
    export interface Metadata {
        /**
         * gRPC authentication context attached to the metadata.
         */
        [GRPC_AUTHENTICATION_SYMBOL]?: GrpcAuthenticationContext;
    }
}
