import { Injectable, type PipeTransform } from "@nestjs/common";
import { z } from "zod";
import { ZPipe, type ZPipeOptions } from "./zod.pipe.js";

/**
 * A pipe that validates a boolean query parameter.
 *
 * Truthy values are `true`, `1`, `"true"`, `"1"` and `"on"`.
 * Falsy values are `false`, `0`, `"false"`, `"0"` and `"off"`.
 */
@Injectable()
export class ZBoolParamPipe extends ZPipe<boolean> implements PipeTransform {
    constructor(options?: ZPipeOptions) {
        super(
            z
                .union(
                    [
                        z.literal(true),
                        z.literal(1),
                        z.literal("true"),
                        z.literal("1"),
                        z.literal("on"),
                        z.literal(false),
                        z.literal(0),
                        z.literal("false"),
                        z.literal("0"),
                        z.literal("off"),
                    ],
                    { error: "Invalid boolean value" },
                )
                .transform((v) => v === true || v === 1 || v === "true" || v === "1" || v === "on"),
            options,
        );
    }
}
