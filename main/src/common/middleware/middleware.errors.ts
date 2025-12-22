import { UnauthorizedException } from "@nestjs/common";

export class UnauthorizedClientError extends UnauthorizedException {
    constructor() {
        super("Unauthorized client");
    }
}
