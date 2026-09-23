import type { MsPattern } from "@nestjs/microservices";
import type { RabbitMqMethodPattern } from "./rabbitmq.server.js";

export function normalizeRabbitPattern(pattern: MsPattern): RabbitMqMethodPattern {
    let obj: Record<string, any> = {};

    if (typeof pattern === "string") {
        if (pattern.startsWith("{")) {
            try {
                const parsed = JSON.parse(pattern);
                if (typeof parsed === "object" && parsed !== null && "routingKey" in parsed) {
                    obj = parsed;
                }
            } catch {
                obj = { routingKey: pattern };
            }
        }
        obj = { routingKey: pattern };
    } else if (typeof pattern === "object" && pattern !== null && "routingKey" in pattern) {
        obj = pattern;
    } else {
        obj = { routingKey: String(pattern) };
    }

    return {
        exchange: obj.exchange,
        routingKey: obj.routingKey,
        connection: obj.connection,
        options: obj.options,
        queue: obj.queue,
        queueSuffix: obj.queueSuffix,
    };
}
