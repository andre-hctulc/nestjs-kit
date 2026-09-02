import type { MsPattern } from "@nestjs/microservices";
import type { RabbitMqMethodPattern } from "./rabbitmq.server.js";

export function normalizeRabbitPattern(pattern: MsPattern): RabbitMqMethodPattern {
    let obj: Record<string, any> = {};

    if (typeof pattern === "string") {
        obj = { routingKey: pattern };
    } else if (typeof pattern === "object" && pattern !== null && "routingKey" in pattern) {
        obj = pattern;
    } else {
        obj = { routingKey: String(pattern) };
    }

    return {
        exchange: obj.exchange,
        routingKey: obj.routingKey,
        queue: obj.queue,
        connection: obj.connection,
        options: obj.options,
    };
}

export function normalizeAndSerializeRabbitPattern(pattern: MsPattern): string {
    return JSON.stringify(normalizeRabbitPattern(pattern));
}
