export type PermissionDefinition = {
    /**
     * Name of the permission
     */
    name: string;
    description?: string;
    /**
     * target id
     */
    target?: string;
    tags?: string[];
    data?: any;
};

export type PermissionSet = Record<string, PermissionDefinition>;
