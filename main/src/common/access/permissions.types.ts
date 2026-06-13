export type PermissionRef<T = any> = {
    id: string;
    data?: T;
};

export type PermissionRefMap = Record<string, PermissionRef>;
