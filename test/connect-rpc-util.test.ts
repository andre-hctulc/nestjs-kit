import { fromJson } from "@bufbuild/protobuf";
import { ValueSchema } from "@bufbuild/protobuf/wkt";
import { ChunkSchema, ExhyveExtensionRuntime, type Chunk } from "./generated/gateway_pb.js";
import {
    type PlainFromGenerated,
    unwrapBySchema,
    unwrapProtoMessage,
    wrapBySchema,
} from "../src/connect-rpc/value.util.js";
import { describe, it, expect } from "@jest/globals";

describe("connect-rpc value wrapping", () => {
    const executeCommand = ExhyveExtensionRuntime.method.executeCommand;
    const outputSchema = executeCommand.output;
    const inputSchema = executeCommand.input as any;
    const dataFieldSchema =
        outputSchema.field?.data ?? outputSchema.fields.find((f: any) => f.localName === "data");
    const paramsFieldSchema =
        inputSchema.field?.params ?? inputSchema.fields.find((f: any) => f.localName === "params");

    it("unwraps wrapped google.protobuf.Value fields from input/output messages", () => {
        const wrappedValue = fromJson(ValueSchema, {
            status: "ok",
            count: 2,
            nested: { active: true },
            items: [1, "two", false],
        });

        const outputMessage = {
            done: false,
            stream: true,
            data: wrappedValue,
        };

        const unwrapped = unwrapBySchema(outputMessage, executeCommand.output) as {
            done: boolean;
            stream: boolean;
            data: unknown;
        };

        expect(unwrapped.done).toBe(false);
        expect(unwrapped.stream).toBe(true);
        expect(unwrapped.data).toEqual({
            status: "ok",
            count: 2,
            nested: { active: true },
            items: [1, "two", false],
        });
    });

    it("wraps plain js values into google.protobuf.Value for schema fields", () => {
        const outputMessage = {
            done: true,
            stream: false,
            data: {
                status: "ok",
                items: [1, 2],
            },
        };

        const wrapped = wrapBySchema(outputMessage, executeCommand.output) as {
            data: unknown;
        };

        expect((wrapped.data as { $typeName?: string }).$typeName).toBe("google.protobuf.Value");
        expect(unwrapProtoMessage(wrapped.data)).toEqual({
            status: "ok",
            items: [1, 2],
        });
    });

    it("does not re-wrap already wrapped google.protobuf.Value instances", () => {
        const wrappedValue = fromJson(ValueSchema, { already: "wrapped" });
        const outputMessage = {
            done: true,
            stream: false,
            data: wrappedValue,
        };

        const wrapped = wrapBySchema(outputMessage, executeCommand.output) as {
            data: unknown;
        };

        expect(wrapped.data).toBe(wrappedValue);
    });

    it("wraps plain values with a Value field descriptor schema", () => {
        const wrapped = wrapBySchema({ hello: "world", n: 1 }, dataFieldSchema) as {
            $typeName?: string;
        };

        expect(wrapped.$typeName).toBe("google.protobuf.Value");
        expect(unwrapProtoMessage(wrapped)).toEqual({ hello: "world", n: 1 });
    });

    it("unwraps wrapped values with a Value field descriptor schema", () => {
        const wrappedValue = fromJson(ValueSchema, {
            nested: { ok: true },
            list: [1, "two"],
        });

        const unwrapped = unwrapBySchema(wrappedValue, dataFieldSchema);
        expect(unwrapped).toEqual({ nested: { ok: true }, list: [1, "two"] });
    });

    it("keeps non-wrapper Struct fields as plain objects", () => {
        const inputMessage = {
            commandName: "test",
            params: { plain: "object", list: [1, 2, 3] },
            extension: {
                name: "ext",
                namespace: "fdc",
                version: "1.0.0",
            },
        };

        const unwrapped = unwrapBySchema(inputMessage, executeCommand.input) as {
            params: unknown;
        };

        expect(unwrapped.params).toEqual({ plain: "object", list: [1, 2, 3] });
    });

    it("wraps Struct field descriptor values and leaves plain input unchanged on unwrap", () => {
        const params = { plain: "object", list: [1, 2, 3] };

        const wrapped = wrapBySchema(params, paramsFieldSchema) as { $typeName?: string };
        expect(wrapped.$typeName).toBe("google.protobuf.Struct");
        expect(unwrapBySchema(params, paramsFieldSchema)).toEqual(params);
    });

    it("accepts Buf-generated plain JSON message shapes as the consumer-facing type", () => {
        const plainChunk: PlainFromGenerated<Chunk> = {
            done: false,
            stream: true,
            data: {
                status: "ok",
                nested: { active: true },
                items: [1, "two", false],
            },
        };

        const wrapped = wrapBySchema(plainChunk, ChunkSchema);

        expect((wrapped as { data?: { $typeName?: string } }).data?.$typeName).toBe("google.protobuf.Value");
        expect(unwrapBySchema(wrapped, ChunkSchema)).toEqual(plainChunk);
    });
});
