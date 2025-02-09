import { Injectable } from "@nestjs/common";

/**
 * Revives dates from ISO strings in any value.
 * Objects are recursively traversed.
 */
@Injectable()
export class DateReviverPipe {
    transform(value: any): any {
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
            return new Date(value);
        }

        // recursively traverse plain objects
        if (typeof value === "object" && value && value.constructor === Object) {
            value = { ...value };
            for (const key in value) {
                value[key] = this.transform(value[key]);
            }
        }

        return value;
    }
}
