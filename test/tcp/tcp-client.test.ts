import { ClientProxyFactory, Transport } from "@nestjs/microservices";

const nativeTcpClient = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: "localhost", port: 3000 },
});

export function sendHelloWorld() {
    nativeTcpClient.send("helloWorld", { text: "Good evening!" });
}
