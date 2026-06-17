export const DEV_MODE =
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "dev" ||
    process.env.NODE_ENV === "test";

export type Casing = "upper" | "original" | "lower" | "camel" | "pascal" | "kebab" | "header_case";

export function convertCasing(text: string, casing: Casing) {
    switch (casing) {
        case "upper":
            return text.toUpperCase();
        case "lower":
            return text.toLowerCase();
        case "camel":
            return text.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        case "pascal":
            return text.replace(/(^\w|-\w)/g, (g) => g.replace(/-/, "").toUpperCase());
        case "header_case":
            return text
                .split("-")
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join("-");
        case "kebab":
            return text.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
        default:
            return text;
    }
}
