import { ForbiddenException, Injectable, type CanActivate } from "@nestjs/common";

@Injectable()
export class RejectGuard implements CanActivate {
    canActivate(): boolean {
        throw new ForbiddenException("guard rejected");
    }
}
