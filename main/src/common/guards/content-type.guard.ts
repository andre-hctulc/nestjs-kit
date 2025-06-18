import { Injectable, CanActivate, ExecutionContext, UnsupportedMediaTypeException } from "@nestjs/common";

type ContentTypeCheck = string | string[] | ((contentType: string) => boolean);

@Injectable()
export class ContentTypeGuard implements CanActivate {
    constructor(private readonly allowedContentTypes: ContentTypeCheck) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const contentType: string = request.headers["content-type"] || "";

        let isAllowed = false;

        if (typeof this.allowedContentTypes === "function") {
            isAllowed = this.allowedContentTypes(contentType);
        } else {
            const allowedTypes = Array.isArray(this.allowedContentTypes)
                ? this.allowedContentTypes
                : [this.allowedContentTypes];

            isAllowed = allowedTypes.some((type) => contentType.startsWith(type));
        }

        if (!isAllowed) {
            throw new UnsupportedMediaTypeException();
        }

        return true;
    }
}
