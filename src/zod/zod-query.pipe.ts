import { Injectable, type PipeTransform } from "@nestjs/common";
import { ZodType } from "zod";
import { zodCoerceQuery } from "./zod-util.js";
import { ZPipe, type ZPipeOptions } from "./zod.pipe.js";

/**
 * A pipe that validates query parameters using a zod schema.
 */
@Injectable()
export class ZQueryPipe<T extends object> extends ZPipe<T> implements PipeTransform {
    constructor(schema: ZodType<T>, options?: ZPipeOptions) {
        super(zodCoerceQuery(schema as any) as ZodType<T>, options);
    }
}
