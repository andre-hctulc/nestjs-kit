import type { BusboyConfig } from "busboy";

export interface MultipartDecoratorOptions extends Omit<BusboyConfig, "headers"> {
    /**
     * Throw {@link UnsupportedMediaTypeException} if the request is not multipart?
     *
     * By default null is returned if the request is not multipart.
     */
    required?: boolean;
}
