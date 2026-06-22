// content-types.decorator.ts
import { SetMetadata } from "@nestjs/common";

export function ContentType(...types: string[]) {
    SetMetadata(ContentType.KEY, types);
}

ContentType.KEY = "content-types";
