interface Accepted {
    /**
     * _true_ if the operation was successful, _false_ otherwise.
     * For most cases, this is always _true_.
     */
    accepted: boolean;
}

export type CommonBody = Partial<
    {
        size: number;
        accepted: boolean;
    } & Record<string, any>
>;

export interface CreatedResBody extends Accepted {
    /**
     * The ids of the created resource.s Can be empty if no ids are available.
     */
    created_id: string | string[];
}

export interface UpdatedResBody extends Accepted {
    /**
     * The ids of the updated resources. Can be empty if no id is available.
     */
    updated_id: string | string[];
}

export interface AcceptedResBody extends Accepted {}

export interface ResultResBody<T = any> extends Accepted {
    /**
     * Result of the operation
     */
    result: T;
    /**
     * The length of the result. If the result is an array, this is the length of the array,
     * otherwise it is 1 if the result is not null or undefined and 0 if it is.
     */
    resultLength: number;
}

/**
 * Create a body for a successful creation operation.
 * The body provides the ids of the created resources either as a single id or an array of ids.
 * @param more Additional properties to include in the body.
 */
export function createdBody<B extends CommonBody = object>(
    created_id: string | string[],
    more?: B
): CreatedResBody & B {
    return { created_id, accepted: true, ...(more as any) };
}

/**
 * Create a body for a successful operation.
 * @param more Additional properties to include in the body.
 */
export function acceptedBody<B extends CommonBody = object>(more?: B): AcceptedResBody & B {
    return { accepted: true, ...(more as any) };
}

/**
 * Create a body for a successful query operation. The body includes the result and the length of the result.
 * @param more Additional properties to include in the body.
 */
export function resultBody<T, B extends CommonBody = object>(
    result: T,
    more?: CommonBody
): ResultResBody<T> & B {
    return {
        result,
        accepted: true,
        resultLength: Array.isArray(result) ? result.length : result == null ? 0 : 1,
        ...(more as any),
    };
}
