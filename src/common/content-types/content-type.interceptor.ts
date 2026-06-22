import {
    type CallHandler,
    type ExecutionContext,
    Injectable,
    type NestInterceptor,
    UnsupportedMediaTypeException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { ContentType } from "./content-type.decorator.js";
import type { FastifyRequest } from "fastify";

@Injectable()
export class ContentTypeInterceptor implements NestInterceptor {
    constructor(private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const allowedTypes = this.reflector.getAllAndOverride<string[]>(ContentType.KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!allowedTypes) {
            return next.handle();
        }

        const req = context.switchToHttp().getRequest<FastifyRequest>();
        const contentType = req.headers["content-type"] ?? "";

        const valid = allowedTypes.some((t) => contentType.startsWith(t));

        if (!valid) {
            throw new UnsupportedMediaTypeException();
        }

        return next.handle();
    }
}
