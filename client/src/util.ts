import type { CommonErrorObject } from "./index.js";

/**
 * Checks if the given value is an {@link ErrorBody} produced by the `HttpExceptionsFilter`.
 */
export function isErrorBody(body: unknown): body is CommonErrorObject {
    return (
        !!body &&
        typeof body === "object" &&
        typeof (body as CommonErrorObject).message === "string" &&
        typeof (body as CommonErrorObject).code === "number" &&
        !!(body as CommonErrorObject).details &&
        typeof (body as CommonErrorObject).details === "object"
    );
}

/**
 * Parses an {@link ErrorBody} produced by the  `HttpExceptionsFilter`.
 * @param value Either a raw value or a {@link Response} object.
 */
export async function parseErrorBody(value: any): Promise<CommonErrorObject | null> {
    try {
        if (value instanceof Response) {
            if (!value.headers.get("content-type")?.includes("application/json")) {
                return null;
            }
            value = await value.json();
        }
        if (isErrorBody(value)) {
            return value;
        }
        return null;
    } catch (e) {
        return null;
    }
}
