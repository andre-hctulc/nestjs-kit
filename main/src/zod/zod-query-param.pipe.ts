import { Injectable, type PipeTransform } from "@nestjs/common";
import { ZodType } from "zod";
import { zodCoerceQueryParam } from "./zod-util.js";
import { ZPipe, type ZPipeOptions } from "./zod.pipe.js";

/**
 * A pipe that validates a query parameter using a zod schema.
 */
@Injectable()
export class ZQueryParamPipe<T> extends ZPipe<T> implements PipeTransform {
    constructor(schema: ZodType<T>, options?: ZPipeOptions) {
        super(zodCoerceQueryParam(schema) as ZodType<T>, options);
    }
}
