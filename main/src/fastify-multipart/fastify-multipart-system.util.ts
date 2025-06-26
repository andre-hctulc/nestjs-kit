export function flatten(obj: Record<string, any>) {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => {
            if (Array.isArray(value) && value.length === 1) {
                return [key, value[0]];
            }
            return [key, value];
        })
    );
}
