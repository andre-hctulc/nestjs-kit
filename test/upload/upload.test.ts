import { createTestApp } from "../app/index.js";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Agent, request as httpRequest } from "node:http";
import { connect, type Socket } from "node:net";
import { UploadModule } from "../../src/upload/index.js";
import { RejectGuard } from "./reject.guard.js";
import { UploadController } from "./upload.controller.js";
import { UploadTestService } from "./upload-test.service.js";

describe("raw upload transport lifecycle (real HTTP)", () => {
    let app: NestFastifyApplication;
    let state: UploadTestService;
    let port: number;
    const sockets = new Set<Socket>();
    const unhandled: unknown[] = [];
    const onUnhandled = (error: unknown) => unhandled.push(error);

    beforeAll(async () => {
        process.on("unhandledRejection", onUnhandled);
        state = new UploadTestService();
        app = await createTestApp({
            imports: [UploadModule],
            controllers: [UploadController],
            providers: [RejectGuard, { provide: UploadTestService, useValue: state }],
        }, {
            fastify: { bodyLimit: 8 },
            configure(fastify) {
                fastify.addHook("preValidation", async (request) => {
                    if (request.routeOptions.url === "/validation") {
                        throw new BadRequestException("validation rejected");
                    }
                });
                fastify.addHook("onRequest", async (request) => {
                    state.listenerCounts.set(request, ["error", "close", "aborted"].map((event) => request.raw.listenerCount(event)));
                });
            },
        });
        await app.listen(0, "127.0.0.1");
        const address = app.getHttpServer().address();
        if (!address || typeof address === "string") {
            throw new Error("Expected TCP server address");
        }
        port = address.port;
    });

    afterAll(async () => {
        for (const socket of sockets) socket.destroy();
        await app?.close();
        process.removeListener("unhandledRejection", onUnhandled);
        expect(unhandled).toEqual([]);
    });

    function send(path: string, body: string, headers: Record<string, string>, agent?: Agent) {
        return new Promise<{ status: number; body: string; socket: Socket; headers: Record<string, unknown> }>((resolve, reject) => {
            const request = httpRequest({ host: "127.0.0.1", port, path, method: "POST", headers, agent }, (response) => {
                let result = "";
                response.setEncoding("utf8");
                response.on("data", (chunk) => { result += chunk; });
                response.on("error", reject);
                response.on("end", () => resolve({
                    status: response.statusCode!,
                    body: result,
                    socket,
                    headers: response.headers,
                }));
            });
            let socket: Socket;
            request.on("socket", (value) => { socket = value; });
            request.on("error", reject);
            request.setTimeout(2000, () => request.destroy(new Error("HTTP request timed out")));
            request.end(body);
        });
    }

    function open() {
        const socket = connect({ host: "127.0.0.1", port });
        sockets.add(socket);
        socket.once("close", () => sockets.delete(socket));
        return socket;
    }

    // Deliberately never finish the body: injection cannot prove transport closure.
    function unfinished(path: string, framing = "Transfer-Encoding: chunked", body = "1\r\nx\r\n", contentType = "application/octet-stream") {
        return new Promise<string>((resolve, reject) => {
            const socket = open();
            let response = "";
            const timeout = setTimeout(() => {
                socket.destroy();
                reject(new Error(`Connection did not close promptly: ${response}`));
            }, 2000);
            socket.setEncoding("utf8");
            socket.on("data", (chunk) => { response += chunk; });
            socket.on("error", (error) => reject(new Error(`${error.message}; response: ${response}`)));
            socket.on("close", () => {
                clearTimeout(timeout);
                resolve(response);
            });
            socket.write(`POST /${path} HTTP/1.1\r\nHost: localhost\r\nContent-Type: ${contentType}\r\n${framing}\r\n\r\n${body}`);
        });
    }

    it("streams successfully and reuses the same keep-alive connection", async () => {
        const agent = new Agent({ keepAlive: true, maxSockets: 1 });
        try {
            const first = await send("/upload", "12345678", { "content-type": "image/custom", "content-length": "8" }, agent);
            const second = await send("/upload", "", { "content-type": "text/plain", "content-length": "0" }, agent);
            expect(first.status).toBe(201);
            expect(JSON.parse(first.body)).toEqual({ size: 8 });
            expect(second.status).toBe(201);
            expect(JSON.parse(second.body)).toEqual({ size: 0 });
            expect(second.socket).toBe(first.socket);
            expect(first.headers.connection).toBe("keep-alive");
        } finally {
            agent.destroy();
        }
    });

    it("accepts an empty upload with a zero limit", async () => {
        expect((await send("/empty", "", { "content-type": "application/json", "content-length": "0" })).body).toBe('{"size":0}');
    });

    it("releases its request listeners after a successful response", async () => {
        await send("/upload", "x", { "content-type": "application/octet-stream", "content-length": "1" });
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(state.observedStream?.destroyed).toBe(true);
        const request = state.observedRequest!;
        expect(["error", "close", "aborted"].map((event) => request.raw.listenerCount(event)))
            .toEqual(state.listenerCounts.get(request));
    });

    it("cleans up an unconsumed wrapper when the handler returns without destroying it", async () => {
        const response = await unfinished("abandon");
        expect(response).toMatch(/^HTTP\/1.1 201 /);
        expect(JSON.parse(response.split("\r\n\r\n")[1])).toEqual({ accepted: false });
        expect(state.observedStream?.destroyed).toBe(true);
        const request = state.observedRequest!;
        expect(["error", "close", "aborted"].map((event) => request.raw.listenerCount(event)))
            .toEqual(state.listenerCounts.get(request));
    });

    it("returns a Readable for empty requests without Content-Type", async () => {
        const response = await send("/empty", "", {});
        expect(response.status).toBe(201);
        expect(JSON.parse(response.body)).toEqual({ size: 0 });
    });

    it.each(["application/json", "text/plain", "image/png", "application/x-custom"])("streams %s bytes without parsing", async (contentType) => {
        const response = await send("/upload", "{invalid", { "content-type": contentType, "content-length": "8" });
        expect(response.status).toBe(201);
        expect(JSON.parse(response.body)).toEqual({ size: 8 });
    });

    it("counts multibyte content as bytes rather than characters", async () => {
        const response = await send("/upload", "\u00e9".repeat(5), { "content-type": "text/plain" });
        expect(response.status).toBe(413);
    });

    it("delivers chunks to the consumer before the request ends", async () => {
        const started = new Promise<void>((resolve) => { state.consumerStarted = resolve; });
        const response = new Promise<string>((resolve, reject) => {
            const request = httpRequest({ host: "127.0.0.1", port, path: "/progress", method: "POST",
                headers: { "content-type": "application/octet-stream" } }, (reply) => {
                let body = "";
                reply.setEncoding("utf8");
                reply.on("data", (chunk) => { body += chunk; });
                reply.on("error", reject);
                reply.on("end", () => resolve(body));
            });
            request.on("error", reject);
            request.setTimeout(2000, () => request.destroy(new Error("Streaming request timed out")));
            request.write("1");
            void started.then(() => request.end("2345678"));
        });
        try {
            expect(JSON.parse(await response)).toEqual({ size: 8 });
        } finally {
            state.consumerStarted = undefined;
        }
    });

    it("bounds buffering while a consumer has not started reading", async () => {
        const started = new Promise<void>((resolve) => { state.consumerStarted = resolve; });
        const response = unfinished("backpressure", `Content-Length: ${1024 * 1024}\r\nConnection: close`, "x".repeat(1024 * 1024));
        try {
            await started;
            // Let the readable side reach backpressure without ever consuming it.
            await new Promise<void>((resolve) => setImmediate(resolve));
            expect(state.observedStream?.readableLength).toBeGreaterThan(0);
            expect(state.observedStream!.readableLength).toBeLessThan(256 * 1024);
            expect(state.observedRequest!.raw.socket.bytesRead).toBeLessThan(1024 * 1024);
        } finally {
            state.releaseUpload?.();
            state.releaseUpload = undefined;
            state.consumerStarted = undefined;
            const result = await response;
            expect(result).toMatch(/^HTTP\/1.1 201 /);
            expect(JSON.parse(result.split("\r\n\r\n")[1])).toEqual({ size: 1024 * 1024 });
        }
    });

    it.each([
        ["upload", "Content-Length: 9", "", 413, "Payload Too Large"],
        ["upload", "Content-Length: 9", "x", 413, "Payload Too Large"],
        ["upload", "Transfer-Encoding: chunked", "9\r\n123456789\r\n", 413, "Payload Too Large"],
        ["empty", "Transfer-Encoding: chunked", "1\r\nx\r\n", 413, "Payload Too Large"],
        ["guard", "Transfer-Encoding: chunked", "", 403, "guard rejected"],
        ["guard", "Transfer-Encoding: chunked", "1\r\nx\r\n", 403, "guard rejected"],
        ["validation", "Transfer-Encoding: chunked", "1\r\nx\r\n", 400, "validation rejected"],
        ["reject", "Transfer-Encoding: chunked", "1\r\nx\r\n", 400, "controller rejected"],
        ["partial", "Transfer-Encoding: chunked", "1\r\nx\r\n", 500, "storage failed"],
        ["destroy", "Transfer-Encoding: chunked", "", 400, "abandoned"],
        ["destroy-active", "Transfer-Encoding: chunked", "1\r\nx\r\n", 400, "abandoned active stream"],
    ])("delivers an error then closes an unfinished %s request (%s / %s)", async (path, framing, body, status, message) => {
        const response = await unfinished(path, framing, body);
        expect(response).toMatch(new RegExp(`^HTTP/1.1 ${status} `));
        expect(response.toLowerCase()).toContain("connection: close");
        const [headers, result] = response.split("\r\n\r\n");
        const length = Number(headers.match(/content-length: (\d+)/i)?.[1]);
        expect(Buffer.byteLength(result)).toBe(length);
        expect(JSON.parse(result).message).toContain(message);
    });

    it("terminates active consumers on client disconnect", async () => {
        let socket: Socket | undefined;
        const started = new Promise<void>((resolve) => { state.consumerStarted = resolve; });
        const failed = new Promise<void>((resolve) => { state.disconnected = resolve; });
        try {
            socket = open();
            socket.write("POST /disconnect HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/octet-stream\r\nTransfer-Encoding: chunked\r\n\r\n1\r\nx\r\n");
            await started;
            socket.destroy();
            await failed;
            expect(state.observedStream?.destroyed).toBe(true);
        } finally {
            socket?.destroy();
            state.consumerStarted = undefined;
            state.disconnected = undefined;
        }
    });

    it.each([
        ["application/json", '{"x":1}', 201, { body: { x: 1 } }],
        ["text/plain", "hello", 201, { body: "hello" }],
        ["application/json", "{", 400, undefined],
        ["application/json", "", 400, undefined],
        ["text/plain", "123456789", 413, undefined],
        ["application/octet-stream", "x", 415, undefined],
    ])("preserves ordinary %s parsing for %s", async (contentType, body, status, result) => {
        const response = await send("/ordinary", body, { "content-type": contentType, "content-length": String(Buffer.byteLength(body)) });
        expect(response.status).toBe(status);
        if (result) expect(JSON.parse(response.body)).toEqual(result);
    });

    it("preserves non-upload chunked body limits and complete error responses", async () => {
        const response = await unfinished("ordinary", "Transfer-Encoding: chunked", "9\r\n123456789\r\n", "text/plain");
        expect(response).toMatch(/^HTTP\/1.1 413 /);
        expect(JSON.parse(response.split("\r\n\r\n")[1]).statusCode).toBe(413);
    });
});
