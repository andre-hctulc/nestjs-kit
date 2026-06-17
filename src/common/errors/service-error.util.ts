import type { ServiceErrorOptions } from "./service-error.types.js";

export function mergeTags(options1?: ServiceErrorOptions, options2?: ServiceErrorOptions): string[] {
    const t1 = Array.isArray(options1?.details?.tags) ? options1.details.tags.map(String) : [];
    const t2 = Array.isArray(options2?.details?.tags) ? options2.details.tags.map(String) : [];
    return [...t1, ...t2];
}

export function mergeOptions(
    options1?: ServiceErrorOptions,
    options2?: ServiceErrorOptions,
): ServiceErrorOptions {
    return {
        details: {
            ...options1?.details,
            ...options2?.details,
            tags: mergeTags(options1, options2),
        },
        code: options2?.code || options1?.code,
    };
}
