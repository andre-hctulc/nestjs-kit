// content-types.decorator.ts
import { SetMetadata } from "@nestjs/common";

export function ContentType(types: string | string[]) {
    return SetMetadata(ContentType.KEY, Array.isArray(types) ? types : [types]);
}

ContentType.KEY = "content-types";
