import type { ServiceErrorOptions } from "./service-error.types.js";

export function mergeOptions(options1?: ServiceErrorOptions, options2?: ServiceErrorOptions): ServiceErrorOptions {
    return {
        details: {
            ...options1?.details,
            ...options2?.details,
            tags: [...(options1?.details?.tags || []), ...(options2?.details?.tags || [])],
        },
        code: options2?.code || options1?.code,
    };
}
