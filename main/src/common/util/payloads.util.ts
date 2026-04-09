import { error } from "console";

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

export interface CommonErrorObject extends Omit<CommonPayload, "data"> {
    details: Record<string, any>;
    message: string;
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
        details: {},
        error: true,
        success: false,
        code: 500,
        ...more,
        message: errorMessage,
    };
}

export function objectToErrorObject(obj: any, defaultErrorCode?: string): CommonErrorObject {
    const defaultCode = "UNKNOWN_ERROR";

    // Message
    if (typeof obj === "string") {
        return {
            details: {},
            code: defaultErrorCode ?? defaultCode,
            message: obj,
        };
    }
    // fallback
    else if (!obj || typeof obj !== "object") {
        return {
            message: "Internal Server Error",
            code: defaultErrorCode ?? defaultCode,
            details: {},
        };
    }

    return {
        message: typeof obj.message === "string" ? obj.message : undefined,
        code: typeof obj.code === "string" ? obj.code : (defaultErrorCode ?? defaultCode),
        details: obj.details && typeof obj.details === "object" ? obj.details : {},
    };
}
