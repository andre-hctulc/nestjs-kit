import type { Observable } from "rxjs";

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

export async function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    signal.throwIfAborted();

    return await new Promise<T>((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
            signal.removeEventListener("abort", onAbort);
        };

        const onAbort = () => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            reject(signal.reason ?? new Error("Request was aborted"));
        };

        promise.then(
            (value) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                resolve(value);
            },
            (err) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                reject(err);
            },
        );

        signal.addEventListener("abort", onAbort, { once: true });

        if (signal.aborted) {
            onAbort();
        }
    });
}

export function createAbortError(message: string): Error {
    const error = new Error(message);
    Object.defineProperty(error, "name", { value: "AbortError" });
    return error;
}

export async function firstValueFromObservable<T>(
    observable: Observable<unknown>,
    signal: AbortSignal,
): Promise<T> {
    signal.throwIfAborted();

    return await new Promise<T>((resolve, reject) => {
        let settled = false;
        let seenValue = false;
        let subscription: { unsubscribe: () => void } | null = null;

        const cleanup = () => {
            signal.removeEventListener("abort", onAbort);
        };

        const onAbort = () => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            subscription?.unsubscribe();
            reject(signal.reason ?? createAbortError("Request was aborted"));
        };

        subscription = observable.subscribe({
            next: (value: unknown) => {
                if (settled) {
                    return;
                }
                settled = true;
                seenValue = true;
                cleanup();
                subscription?.unsubscribe();
                resolve(value as T);
            },
            error: (err: unknown) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                subscription?.unsubscribe();
                reject(err);
            },
            complete: () => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                if (seenValue) {
                    return;
                }
                reject(new Error("Observable completed without emitting a value"));
            },
        });

        signal.addEventListener("abort", onAbort, { once: true });

        if (signal.aborted) {
            onAbort();
        }
    });
}

export function resolveFinalTimeout(
    deadline: Date | number | undefined,
    timeout: number,
    maxTimeout: number,
): number {
    const clientTimeout =
        deadline instanceof Date
            ? deadline.getTime() - Date.now()
            : typeof deadline === "number"
              ? deadline - Date.now()
              : undefined;
    const boundedTimeout = Math.min(clientTimeout ?? timeout, maxTimeout);
    return Math.max(0, boundedTimeout);
}
