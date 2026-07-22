import { fromJson, type DescField, type DescMessage, type JsonValue } from "@bufbuild/protobuf";
import type { ListValue, Value } from "@bufbuild/protobuf/wkt";
import { ListValueSchema, StructSchema, ValueSchema } from "@bufbuild/protobuf/wkt";
import { getProperty, setProperty } from "dot-prop";

export function unwrapValue<T = unknown>(val: Value | ListValue): T {
    if ("values" in val) {
        return val.values.map(unwrapValue) as T;
    }

    switch (val.kind.case) {
        case "nullValue":
            return null as T;
        case "boolValue":
            return val.kind.value as T; // boolean
        case "numberValue":
            return val.kind.value as T; // number
        case "stringValue":
            return val.kind.value as T; // string
        case "listValue":
            return val.kind.value.values.map(unwrapValue) as T; // recursive
        case "structValue":
            // Convert Struct to plain object
            const obj: Record<string, unknown> = {};
            for (const [key, v] of Object.entries(val.kind.value.fields)) {
                obj[key] = unwrapValue(v);
            }
            return obj as T;
        default:
            return undefined as T;
    }
}

export function unwrapProtoMessage<T = unknown>(value: unknown): T {
    if (!value || typeof value !== "object") {
        return value as T;
    }

    const message = value as Record<string, any> & { $typeName?: string };

    switch (message.$typeName) {
        case "google.protobuf.Value":
            return unwrapValue(message as Value) as T;
        case "google.protobuf.ListValue":
            return unwrapValue(message as ListValue) as T;
        default:
            return value as T;
    }
}

export function wrapBySchema(value: unknown, schema: DescMessage | DescField | undefined): unknown {
    if (value === null || value === undefined) {
        return value;
    }

    if (!schema) {
        return value;
    }

    if (schema.kind === "message") {
        if (schema.typeName === "google.protobuf.Value") {
            return isWrappedProtoMessage(value, schema.typeName)
                ? value
                : fromJson(ValueSchema, value as JsonValue);
        }

        if (schema.typeName === "google.protobuf.ListValue") {
            return isWrappedProtoMessage(value, schema.typeName)
                ? value
                : fromJson(ListValueSchema, value as JsonValue);
        }

        if (schema.typeName === "google.protobuf.Struct") {
            return isWrappedProtoMessage(value, schema.typeName)
                ? value
                : fromJson(StructSchema, value as JsonValue);
        }

        if (Array.isArray(value)) {
            return value.map((item) => wrapBySchema(item, schema));
        }

        if (!value || typeof value !== "object") {
            return value;
        }

        const copy = { ...(value as Record<string, unknown>) };

        for (const field of schema.fields) {
            const fieldValue = copy[field.localName];
            if (fieldValue === undefined) {
                continue;
            }

            copy[field.localName] = wrapField(fieldValue, field);
        }

        return copy;
    }

    if (schema.kind === "field") {
        return wrapField(value, schema);
    }

    return value;
}

export function unwrapBySchema(value: unknown, schema: DescMessage | DescField | undefined): unknown {
    if (value === null || value === undefined) {
        return value;
    }

    if (!schema) {
        return value;
    }

    if (schema.kind === "message") {
        if (schema.typeName === "google.protobuf.Value") {
            return unwrapProtoMessage(value);
        }

        if (schema.typeName === "google.protobuf.ListValue") {
            return unwrapProtoMessage(value);
        }

        if (schema.typeName === "google.protobuf.Struct") {
            return value;
        }

        if (Array.isArray(value)) {
            return value.map((item) => unwrapBySchema(item, schema));
        }

        const copy = { ...(value as Record<string, unknown>) };

        for (const field of schema.fields) {
            const fieldValue = copy[field.localName];
            if (fieldValue === undefined) {
                continue;
            }

            copy[field.localName] = unwrapField(fieldValue, field);
        }

        return copy;
    }

    if (schema.kind === "field") {
        return unwrapField(value, schema);
    }

    return value;
}

function wrapField(value: unknown, field: DescField): unknown {
    if (field.fieldKind === "message") {
        return wrapBySchema(value, field.message);
    }

    if (field.fieldKind === "list") {
        if (field.listKind === "message") {
            if (!Array.isArray(value)) {
                return value;
            }

            return value.map((item) => wrapBySchema(item, field.message));
        }

        return value;
    }

    if (field.fieldKind === "map") {
        if (field.mapKind === "message") {
            if (!value || typeof value !== "object" || Array.isArray(value)) {
                return value;
            }

            const copy = { ...(value as Record<string, unknown>) };

            for (const [key, item] of Object.entries(copy)) {
                copy[key] = wrapBySchema(item, field.message);
            }

            return copy;
        }

        return value;
    }

    return value;
}

function unwrapField(value: unknown, field: DescField): unknown {
    if (field.fieldKind === "message") {
        return unwrapBySchema(value, field.message);
    }

    if (field.fieldKind === "list") {
        if (field.listKind === "message") {
            if (!Array.isArray(value)) {
                return value;
            }

            return value.map((item) => unwrapBySchema(item, field.message));
        }

        return value;
    }

    if (field.fieldKind === "map") {
        if (field.mapKind === "message") {
            if (!value || typeof value !== "object" || Array.isArray(value)) {
                return value;
            }

            const copy = { ...(value as Record<string, unknown>) };

            for (const [key, item] of Object.entries(copy)) {
                copy[key] = unwrapBySchema(item, field.message);
            }

            return copy;
        }

        return value;
    }

    return value;
}

function isWrappedProtoMessage(value: unknown, typeName: string): boolean {
    return Boolean(
        value && typeof value === "object" && !Array.isArray(value) && (value as any).$typeName === typeName,
    );
}

export function wrapValue(value: any): Value {
    if (Array.isArray(value)) {
        return {
            kind: {
                case: "listValue",
                value: { values: value.map(wrapValue), $typeName: "google.protobuf.ListValue" },
            },
            $typeName: "google.protobuf.Value",
        };
    } else if (value === null) {
        return { kind: { case: "nullValue", value: 0 }, $typeName: "google.protobuf.Value" };
    } else if (typeof value === "boolean") {
        return { kind: { case: "boolValue", value }, $typeName: "google.protobuf.Value" };
    } else if (typeof value === "number") {
        return { kind: { case: "numberValue", value }, $typeName: "google.protobuf.Value" };
    } else if (typeof value === "string") {
        return { kind: { case: "stringValue", value }, $typeName: "google.protobuf.Value" };
    } else if (Array.isArray(value)) {
        return {
            kind: {
                case: "listValue",
                value: { values: value.map(wrapValue), $typeName: "google.protobuf.ListValue" },
            },
            $typeName: "google.protobuf.Value",
        };
    } else if (typeof value === "object" && value !== null) {
        const fields: Record<string, Value> = {};
        for (const [key, val] of Object.entries(value)) {
            fields[key] = wrapValue(val);
        }
        return {
            kind: { case: "structValue", value: { fields, $typeName: "google.protobuf.Struct" } },
            $typeName: "google.protobuf.Value",
        };
    } else {
        return { kind: { case: undefined, value: undefined }, $typeName: "google.protobuf.Value" };
    }
}

export function unwrapAt<T extends object = Record<string, unknown>>(
    value: object,
    paths: string | string[],
): T {
    if (typeof paths === "string") {
        paths = [paths];
    }

    const copy = structuredClone(value);

    for (const path of paths) {
        const wrappedValue = getProperty(copy, path);
        if (!wrappedValue) {
            continue;
        }
        const unwrappedValue = unwrapValue(wrappedValue as Value);
        setProperty(copy, path, unwrappedValue);
    }

    return copy as T;
}
