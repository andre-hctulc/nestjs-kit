import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";

@Injectable()
export abstract class RpcGuard implements CanActivate {
    protected abstract guard(data: Record<string, unknown>): boolean | Promise<boolean>;

    canActivate(context: ExecutionContext): boolean | Promise<boolean> {
        const rpc = context.switchToRpc();

        const d = rpc.getData();
        if (!d || typeof d !== "object") {
            throw new RpcException("Invalid data. Expected an object.");
        }

        return this.guard(d);
    }
}
