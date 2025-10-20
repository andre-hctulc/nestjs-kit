/**
 * Common payload interface.
 */
export interface CommonPayload<T = any> {
    data: T;
    code?: string | number;
    message?: string;
    data_length?: number;
    [key: string]: any;
}

export interface Accepted extends Omit<CommonPayload, "data"> {
    code: 200;
}

/**
 * Successful creation operation response.
 */
export interface Created<T = string> extends CommonPayload<T> {
    code: 201;
}

/**
 * Successful update operation response.
 */
export interface Updated<T = string> extends CommonPayload<T> {
    code: 200;
}

export interface CommonErrorObject extends CommonPayload {
    error: any;
}

const dataLength = (result: unknown): number => {
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
        resultLength: dataLength(created),
    };
}

/**
 * Create a body for a successful update operation.
 */
export function updated<T = string>(data: T): Updated<T> {
    return {
        code: 200,
        data: data,
        accepted: true,
        resultLength: dataLength(data),
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
export function commonPayload<T>(data: T, more: Record<string, any>): CommonPayload<T> {
    return {
        data,
        code: 200,
        data_length: dataLength(data),
        ...more,
    };
}

export function objectToErrorObject(
    obj: object | string,
    defaultErrorCode?: string | number
): CommonErrorObject {
    if (typeof obj === "string") {
        return {
            error: obj,
            code: defaultErrorCode ?? 500,
            data: {},
        };
    }

    obj = { ...obj };
    let message: string = "Internal Server Error";
    let code: string | number = defaultErrorCode ?? 500;
    let data: any;

    if ("message" in obj && typeof obj.message === "string") {
        message = obj.message;
        delete obj.message;
    }

    if ("code" in obj && (typeof obj.code === "number" || typeof obj.code === "string")) {
        code = obj.code;
        delete obj.code;
    }

    if ("data" in obj) {
        data = obj.data;
        delete obj.data;
    }

    return {
        error: message,
        code,
        data: data ?? obj,
    };
}
