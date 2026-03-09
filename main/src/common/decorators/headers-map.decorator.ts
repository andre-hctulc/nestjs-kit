import { createParamDecorator } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

export type HeaderNameCasing = "upper" | "original" | "lower" | "camel" | "pascal" | "kebab" | "header_case";

function convertHeadersCase(
    headers: Record<string, string | string[] | undefined>,
    casing: HeaderNameCasing,
) {
    const convertedHeaders: Record<string, string | string[] | undefined> = {};
    for (const key in headers) {
        let newKey: string;
        switch (casing) {
            case "upper":
                newKey = key.toUpperCase();
                break;
            case "lower":
                newKey = key.toLowerCase();
                break;
            case "camel":
                newKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                break;
            case "pascal":
                newKey = key.replace(/(^\w|-\w)/g, (g) => g.replace(/-/, "").toUpperCase());
                break;
            case "header_case":
                newKey = key
                    .split("-")
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                    .join("-");
                break;
            case "kebab":
                newKey = key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
                break;
            default:
                newKey = key;
        }
        convertedHeaders[newKey] = headers[key];
    }
    return convertedHeaders;
}

/**
 * Decorator to extract headers from the request.
 *
 * @param casing The casing to apply to header names. Defaults to "original" (no conversion).
 * @returns The headers map, optionally with converted key casing.
 */
export const HeadersMap = createParamDecorator<
    HeaderNameCasing | undefined,
    Record<string, string | string[] | undefined>
>((casing, ctx) => {
    const http = ctx.switchToHttp();
    const req: FastifyRequest = http.getRequest();

    if (!casing || casing === "original") {
        return req.headers;
    }

    return convertHeadersCase(req.headers, casing);
});
