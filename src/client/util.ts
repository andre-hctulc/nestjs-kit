import type { ErrorBody } from "../exception-filters/http-exceptions.filter.js";
import type { HttpExceptionsFilter } from "../exception-filters/http-exceptions.filter.js";

/**
 * Checks if the given value is an {@link ErrorBody} produced by the {@link HttpExceptionsFilter}.
 */
export function isErrorBody(body: unknown): body is ErrorBody {
    return (
        body &&
        typeof body === "object" &&
        typeof (body as any).message === "string" &&
        typeof (body as any).statusCode === "number" &&
        (body as any).details &&
        typeof (body as any).details === "object"
    );
}

/**
 * Parses an {@link ErrorBody} produced by the {@link HttpExceptionsFilter}.
 * @param value Either a raw value or a {@link Response} object.
 */
export async function parseErrorBody(value: any): Promise<ErrorBody | null> {
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
