import { InternalServerErrorException } from "@nestjs/common";

export class GuardMismatchError extends InternalServerErrorException {
    constructor() {
        super("Guard mismatch");
    }
}
