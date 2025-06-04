export function createSearchParams(
    paramsObj: Record<string, string | undefined | string[]>
): URLSearchParams {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(paramsObj)) {
        if (Array.isArray(value)) {
            value.forEach((v) => searchParams.append(key, v));
        } else if (value !== undefined) {
            searchParams.append(key, value);
        }
    }

    return searchParams;
}

/**
 * String arrays are joined with a comma
 */
export function normalizeParams(
    paramsObj: Record<string, string | undefined | string[]>
): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const [key, value] of Object.entries(paramsObj)) {
        if (Array.isArray(value)) {
            obj[key] = value.join(",");
        } else if (value !== undefined) {
            obj[key] = value;
        }
    }
    return obj;
}

export function paramValue(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
        return value[0];
    } else {
        return value;
    }
}
