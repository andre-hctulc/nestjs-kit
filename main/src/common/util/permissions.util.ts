import { type PermissionDefinition, type PermissionSet } from "./permissions.model.js";

/**
 * Gets all roles that have at least the given role, based on the provided role weight map.
 */
export function getRolesAtLeast(role: string, roleWeightMap: Record<string, number>): string[] {
    const checkWeight = roleWeightMap[role];
    return Object.entries(roleWeightMap)
        .filter(([_, roleWeight]) => roleWeight >= checkWeight)
        .map(([roleName]) => roleName);
}

const PermissionSetSymbol = Symbol();
const allPermissions: Map<string, PermissionDefinition> = new Map();

/**
 * Defines a set of permissions. The set gets registered globally and can be retrieved later.
 */
export function definePermissionSet(set: PermissionSet): PermissionSet {
    const resultSet: PermissionSet = {};
    Object.entries(set).forEach(([key, def]) => {
        const mountedDef: PermissionDefinition = {
            ...def,
        };
        Object.defineProperty(mountedDef, PermissionSetSymbol, {
            enumerable: false,
            configurable: false,
            value: true,
            writable: false,
        });
        allPermissions.set(def.name, mountedDef);
        resultSet[key] = mountedDef;
    });
    return resultSet;
}

/**
 * Get a permissions registered with {@link definePermissionSet}.
 */
export function getPermission(permissionName: string): PermissionDefinition | undefined {
    return allPermissions.get(permissionName);
}

/**
 * Gets all permissions registered with {@link definePermissionSet}.
 */
export function getAllPermissions(): PermissionSet {
    return Object.fromEntries(allPermissions.entries());
}

/**
 * Checks if the given role has the specified permission.
 */
export function hasPermission(role: string, permission: PermissionDefinition) {
    if (!(PermissionSetSymbol in permission)) {
        throw new Error(
            "Permission definition not mounted properly. Use `definePermissionSet` to define permission sets."
        );
    }
    return permission.roles.includes(role);
}
