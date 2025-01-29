import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import z from "zod";

@Injectable()
export class ZodPipe implements PipeTransform {
    constructor(private schema: z.ZodSchema) {}

    transform(value: any, metadata: ArgumentMetadata) {
        const result = this.schema.safeParse(value);

        if (!result.success) {
            throw new BadRequestException(`Param validation failed: ${result.error.message}`, {
                // TODO check this in ExceptionsFilter and add set as detail or message? or is result.error.message enough?
                cause: result.error,
            });
        }

        return result.data;
    }
}
