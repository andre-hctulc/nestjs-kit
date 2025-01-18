import type { ErrorBody } from "../exception-filters/exceptions-filter.js";

export async function parseErrorBody(response: Response): Promise<ErrorBody | null> {
    try {
        const body = await response.json();
        if (isErrorBody(body)) {
            return body;
        }
        return null;
    } catch (e) {
        return null;
    }
}

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
