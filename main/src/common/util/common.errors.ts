import { BadRequestException } from "@nestjs/common";

export class UnsupportedFeatureError extends BadRequestException {
    constructor(featureLabel: string) {
        super(`Feature '${featureLabel}' not supported`);
    }
}

export class EmptyMutationError extends BadRequestException {
    constructor() {
        super("Empty mutation");
    }
}
