import { Injectable, type PipeTransform } from "@nestjs/common";
import { z } from "zod";
import { ZPipe, type ZPipeOptions } from "./zod.pipe.js";

/**
 * A pipe that validates a boolean query parameter.
 *
 * Truthy values are `true`, `1`, `"true"`, `"1"`, and `"on"`.
 */
@Injectable()
export class ZBoolParamPipe extends ZPipe<boolean> implements PipeTransform {
    constructor(options?: ZPipeOptions) {
        super(
            z.custom<boolean>((v) => {
                return v === true || v === 1 || v === "true" || v === "1" || v === "on";
            }),
            options,
        );
    }
}
