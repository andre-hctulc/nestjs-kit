import { InternalServerErrorException, BadRequestException, ForbiddenException } from "@nestjs/common";

/**
 * @extends InternalServerErrorException
 */
export class GuardMismatchError extends InternalServerErrorException {
    constructor() {
        super("Guard mismatch");
    }
}

/**
 * @extends BadRequestException
 */
export class UnsupportedFeatureError extends BadRequestException {
    constructor(featureLabel: string) {
        super(`Feature '${featureLabel}' not supported`);
    }
}

/**
 * @extends BadRequestException
 */
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

/**
 * @extends ForbiddenException
 */
export class AccessDeniedError extends ForbiddenException {
    constructor(reason?: string) {
        super(reason ? `Access denied: ${reason}` : "Access denied");
    }
}
