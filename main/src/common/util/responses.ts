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

/**
 * Body for a successful creation operation.
 */
export interface CreatedResBody<T = string> extends Accepted {
    created: T;
    /**
     * The length of the result. If the result is an array, this is the length of the array,
     * otherwise it is 1 if the result is not null or undefined and 0 if it is.
     */
    resultLength: number;
}

/**
 * Body for a successful update operation.
 */
export interface UpdatedResBody<T = string> extends Accepted {
    updated: T;
    /**
     * The length of the result. If the result is an array, this is the length of the array,
     * otherwise it is 1 if the result is not null or undefined and 0 if it is.
     */
    resultLength: number;
}

/**
 * Body for a successful operation that does not return any data.
 */
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

const resultLength = (result: unknown): number => {
    if (Array.isArray(result)) {
        return result.length;
    } else if (result === undefined) {
        return 0;
    } else {
        return 1;
    }
};

/**
 * Create a body for a successful creation operation.
 */
export function createdBody<T = string>(created: T): CreatedResBody<T> {
    return {
        created,
        accepted: true,
        resultLength: resultLength(created),
    };
}

/**
 * Create a body for a successful update operation.
 */
export function updatedBody<T = string>(updated: T): UpdatedResBody<T> {
    return {
        updated,
        accepted: true,
        resultLength: resultLength(updated),
    };
}

/**
 * Create a body for a successful operation.
 */
export function acceptedBody(): AcceptedResBody {
    return { accepted: true };
}

/**
 * Create a body for a successful query operation.
 */
export function resultBody<T>(result: T): ResultResBody<T> {
    return {
        result,
        accepted: true,
        resultLength: resultLength(result),
    };
}
