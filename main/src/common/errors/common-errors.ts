import { InternalServerErrorException, BadRequestException } from "@nestjs/common";

export class GuardMismatchError extends InternalServerErrorException {
    constructor() {
        super("Guard mismatch");
    }
}

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

export class UnsupportedContextTypeError extends Error {
    constructor(contextType: string) {
        super(`Unsupported context type: ${contextType}`);
    }
}
