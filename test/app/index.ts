import "reflect-metadata";
import type { ModuleMetadata } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { FastifyInstance } from "fastify";

export interface TestAppOptions {
    fastify?: ConstructorParameters<typeof FastifyAdapter>[0];
    configure?: (fastify: FastifyInstance) => void | Promise<void>;
}

/** Build an isolated test app; the suite owns listen/init and close. */
export async function createTestApp(
    metadata: ModuleMetadata,
    options: TestAppOptions = {},
): Promise<NestFastifyApplication> {
    const adapter = new FastifyAdapter(options.fastify);
    const adapterHost = new HttpAdapterHost();
    adapterHost.httpAdapter = adapter;
    const module = await Test.createTestingModule(metadata)
        // Some providers register Fastify hooks during construction, before app creation.
        .overrideProvider(HttpAdapterHost)
        .useValue(adapterHost)
        .compile();
    const app = module.createNestApplication<NestFastifyApplication>(adapter, { logger: false });
    await options.configure?.(adapter.getInstance<FastifyInstance>());
    return app;
}
