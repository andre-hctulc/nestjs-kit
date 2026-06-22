import { SetMetadata, type ExecutionContext } from "@nestjs/common";

export function RequestPermissions(...actionName: string[]) {
    return SetMetadata(RequestPermissions.KEY, actionName);
}

RequestPermissions.KEY = "access_request_permissions";

export function getRequestedPermissions(context: ExecutionContext): string[] {
    return [
        ...(Reflect.getMetadata(RequestPermissions.KEY, context.getHandler()) || []),
        ...(Reflect.getMetadata(RequestPermissions.KEY, context.getClass()) || []),
    ];
}

export function getRequestedPermissionFrom(obj: any): string[] {
    return [
        ...(Reflect.getMetadata(RequestPermissions.KEY, obj) || []),
        ...(Reflect.getMetadata(RequestPermissions.KEY, obj) || []),
    ];
}
