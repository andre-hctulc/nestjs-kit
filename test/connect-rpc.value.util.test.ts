import { fromJson } from "@bufbuild/protobuf";
import { ValueSchema } from "@bufbuild/protobuf/wkt";
import { ExhyveExtensionRuntime } from "./generated/gateway_pb.js";
import { unwrapBySchema, unwrapProtoMessage, wrapBySchema } from "../src/connect-rpc/value.util.js";
import { describe, it, expect } from "@jest/globals";

describe("connect-rpc value wrapping", () => {
    const executeCommand = ExhyveExtensionRuntime.method.executeCommand;

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
});
