export type CommonPayload = {
    code: number | string;
};

export interface Accepted extends CommonPayload {
    /**
     * _true_ if the operation was successful, _false_ otherwise.
     * For most cases, this is always _true_.
     */
    accepted: boolean;
}

/**
 * Body for a successful creation operation.
 */
export interface Created<T = string> extends Accepted {
    data: T;
    /**
     * The length of the result. If the result is an array, this is the length of the array,
     * otherwise it is 1 if the result is not null or undefined and 0 if it is.
     */
    resultLength: number;
}

/**
 * Body for a successful update operation.
 */
export interface Updated<T = string> extends Accepted {
    updated: T;
    /**
     * The length of the result. If the result is an array, this is the length of the array,
     * otherwise it is 1 if the result is not null or undefined and 0 if it is.
     */
    resultLength: number;
}

export interface Result<T = any> extends Accepted {
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
export function created<T = string>(created: T): Created<T> {
    return {
        code: 201,
        data: created,
        accepted: true,
        resultLength: resultLength(created),
    };
}

/**
 * Create a body for a successful update operation.
 */
export function updated<T = string>(updated: T): Updated<T> {
    return {
        code: 200,
        updated,
        accepted: true,
        resultLength: resultLength(updated),
    };
}

/**
 * Create a body for a successful operation.
 */
export function accepted(): Accepted {
    return { accepted: true, code: 200 };
}

/**
 * Create a body for a successful query operation.
 */
export function result<T>(result: T): Result<T> {
    return {
        result,
        accepted: true,
        resultLength: resultLength(result),
        code: 200,
    };
}
