export type PermissionDefinition = {
    /**
     * Name of the permission
     */
    name: string;
    /**
     * Roles that have this permission
     */
    roles: string[];
    description?: string;
    /**
     * target id
     */
    target?: string;
    tags?: string[];
    data?: any;
};

export type PermissionSet = Record<string, PermissionDefinition>;
