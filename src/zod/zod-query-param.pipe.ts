import { Injectable, type PipeTransform } from "@nestjs/common";
import { ZodType } from "zod";
import { zodCoerceQueryParam } from "./zod-util.js";
import { ZPipe, type ZPipeOptions } from "./zod.pipe.js";
import { z } from "zod";

/**
 * A pipe that validates a query parameter using a zod schema.
 */
@Injectable()
export class ZQueryParamPipe<T> extends ZPipe<T> implements PipeTransform {
    constructor(schema?: ZodType<T> | boolean, options?: ZPipeOptions) {
        super(
            zodCoerceQueryParam(
                schema === false
                    ? z.string().optional()
                    : schema === undefined || schema === true
                      ? z.string()
                      : schema,
            ) as ZodType<T>,
            options,
        );
    }
}
