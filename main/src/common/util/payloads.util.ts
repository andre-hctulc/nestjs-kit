/**
 * Common payload interface.
 */
export interface CommonPayload<T = any> {
    data: T;
    code?: string | number;
    message?: string;
    length?: number;
    success?: boolean;
    size?: number;
    [key: string]: any;
}

export interface AcceptedPayload<T = undefined> extends CommonPayload<T> {
    code: 200;
}

/**
 * Successful creation operation response.
 */
export interface CreatedPayload<T = string> extends CommonPayload<T> {
    code: 201;
}

/**
 * Successful update operation response.
 */
export interface UpdatedPayload<T = string> extends CommonPayload<T> {
    code: 200;
}

export interface CommonErrorObject extends CommonPayload {
    error: any;
}

export type CommonErrorPayload = CommonErrorObject;

export interface PagedPayload<T = any> extends CommonPayload<T[]> {
    page_index?: number;
    next_page?: any;
}

export interface TruncatedPayload<T = any> extends CommonPayload<T[]> {
    next_token?: any;
    is_truncated?: boolean;
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
export function createdPayload<T>(
    data: T,
    more?: Partial<Omit<CreatedPayload<T>, "code" | "success" | "data">>,
): CreatedPayload<T> {
    return {
        ...more,
        code: 201,
        data: data,
        success: true,
    };
}

/**
 * Create a body for a successful update operation.
 */
export function updatedPayload<T>(
    more?: Partial<Omit<UpdatedPayload<T>, "code" | "success">>,
): UpdatedPayload<T> {
    return {
        data: undefined as T,
        ...more,
        code: 200,
        success: true,
    };
}

/**
 * Create a body for a successful operation.
 */
export function acceptedPayload<T>(
    more?: Partial<Omit<CommonPayload<T>, "code" | "success">>,
): AcceptedPayload<T> {
    return { data: undefined as T, ...more, code: 200, success: true };
}

/**
 * Create a body for a successful query operation.
 */
export function commonPayload<T>(data: T, more?: Partial<CommonPayload>): CommonPayload<T> {
    return {
        data,
        code: 200,
        ...more,
    };
}

/**
 * Create a body for a paged response.
 */
export function pagedPayload<T>(
    data: T[],
    page_index?: number,
    next_page?: any,
    more?: Partial<Omit<PagedPayload<T>, "page_index" | "next_page" | "data">>,
): PagedPayload<T> {
    return {
        code: 200,
        length: dataLength(data),
        ...more,
        page_index,
        next_page,
        data,
    };
}

/**
 * Create a body for a truncated response.
 */
export function truncatedPayload<T>(
    data: T[],
    is_truncated?: boolean,
    next_token?: any,
    more?: Partial<Omit<TruncatedPayload<T>, "is_truncated" | "next_token" | "data">>,
): TruncatedPayload<T> {
    return {
        code: 200,
        length: dataLength(data),
        ...more,
        is_truncated,
        next_token,
        data,
    };
}

/**
 * Create a body for an error response.
 */
export function commonErrorPayload<T>(
    errorMessage: string,
    more?: Partial<CommonErrorPayload>,
): CommonErrorPayload {
    return {
        data: undefined,
        error: true,
        success: false,
        code: 500,
        ...more,
        message: errorMessage,
    };
}

/**
 * Convert an object or string into a CommonErrorObject.
 * @param defaultErrorCode Default error code if none found in the object. Defaults to -1.
 */
export function objectToErrorObject(
    obj: object | string,
    defaultErrorCode?: string | number,
): CommonErrorObject {
    const defaultCode = -1;
    if (typeof obj === "string") {
        return {
            error: obj,
            code: defaultErrorCode ?? defaultCode,
            data: {},
            success: false,
        };
    } else if (!obj || typeof obj !== "object") {
        return {
            error: "Internal Server Error",
            code: defaultErrorCode ?? defaultCode,
            data: {},
            success: false,
        };
    }

    obj = { ...obj };
    let message: string = "Internal Server Error";
    let code: string | number = defaultErrorCode ?? defaultCode;
    let data: any;
    let error: any;

    if ("error" in obj) {
        error = obj.error;
        delete obj.error;
    }

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
        error: error ?? {},
        message,
        code,
        data: data ?? obj,
        success: false,
    };
}
