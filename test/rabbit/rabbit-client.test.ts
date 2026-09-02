import { ClientProxyFactory, Transport } from "@nestjs/microservices";
import { RabbitMqClientProxy } from "../../src/rabbitmq/rabbitmq-client-proxy.class.js";

export const client = new RabbitMqClientProxy({ url: "" });

const nativeRabbitClient = ClientProxyFactory.create({
    transport: Transport.RMQ,
    options: {},
});

export function sendHelloWorld() {
    client.send("helloWorld", { text: "Good evening!" });

    nativeRabbitClient.send("helloWorld", { text: "Good evening!" });
}
