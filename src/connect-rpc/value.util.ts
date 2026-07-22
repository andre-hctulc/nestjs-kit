import type { Value } from "@bufbuild/protobuf/wkt";

export function unwrapValue(val: Value): unknown {
    switch (val.kind.case) {
        case "nullValue":
            return null;
        case "boolValue":
            return val.kind.value; // boolean
        case "numberValue":
            return val.kind.value; // number
        case "stringValue":
            return val.kind.value; // string
        case "listValue":
            return val.kind.value.values.map(unwrapValue); // recursive
        case "structValue":
            // Convert Struct to plain object
            const obj: Record<string, unknown> = {};
            for (const [key, v] of Object.entries(val.kind.value.fields)) {
                obj[key] = unwrapValue(v);
            }
            return obj;
        default:
            return undefined;
    }
}

export function wrapValue(value: any): Value {
    if (value === null) {
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
