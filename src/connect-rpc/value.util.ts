import type { ListValue, Value } from "@bufbuild/protobuf/wkt";
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
