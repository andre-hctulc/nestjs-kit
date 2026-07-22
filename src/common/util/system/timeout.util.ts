import { status } from "@grpc/grpc-js";

export interface CallTimeouts {
    totalTimeoutMs?: number;
    idleTimeoutMs?: number;
}

export class TimeoutController {
    #expiredError: Error | undefined;
    #totalTimer: NodeJS.Timeout | undefined;
    #idleTimer: NodeJS.Timeout | undefined;
    #rejectTimeout!: (reason: unknown) => void;
    #timeoutPromise: Promise<never>;
    #timeouts: CallTimeouts;

    constructor(timeouts: CallTimeouts) {
        this.#timeouts = timeouts;

        this.#timeoutPromise = new Promise<never>((_, reject) => {
            this.#rejectTimeout = reject;
        });

        if (timeouts.totalTimeoutMs !== undefined) {
            this.#totalTimer = setTimeout(
                () => this.expire("gRPC response timeout exceeded"),
                timeouts.totalTimeoutMs,
            );
            this.#totalTimer.unref?.();
        }

        this.#scheduleIdleTimer();
    }

    expire(message: string) {
        if (this.#expiredError) {
            return;
        }

        this.#expiredError = this.#createDeadlineExceededError(message);
        this.#clearTimeout(this.#totalTimer);
        this.#clearTimeout(this.#idleTimer);
        this.#rejectTimeout(this.#expiredError);
    }

    #scheduleIdleTimer() {
        this.#clearTimeout(this.#idleTimer);
        if (!this.#timeouts.idleTimeoutMs || this.#expiredError) {
            return;
        }

        this.#idleTimer = setTimeout(
            () => this.expire("gRPC stream idle timeout exceeded"),
            this.#timeouts.idleTimeoutMs,
        );
        this.#idleTimer.unref?.();
    }

    #clearTimeout(timer?: NodeJS.Timeout) {
        if (timer) {
            clearTimeout(timer);
        }
    }

    async race<T>(promise: Promise<T>): Promise<T> {
        if (this.#expiredError) {
            throw this.#expiredError;
        }

        return await Promise.race([promise, this.#timeoutPromise]);
    }

    async touch() {
        this.#scheduleIdleTimer();
    }

    dispose() {
        this.#clearTimeout(this.#totalTimer);
        this.#clearTimeout(this.#idleTimer);
    }

    isExpired() {
        return this.#expiredError !== undefined;
    }

    #createDeadlineExceededError(message: string): Error {
        return Object.assign(new Error(message), {
            code: status.DEADLINE_EXCEEDED,
            details: JSON.stringify({ message }),
        });
    }
}

export function normalizeTimeout(value?: number): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return undefined;
    }

    return Math.max(1, Math.ceil(value));
}

export function capTimeout(requestedMs?: number, maxMs?: number): number | undefined {
    if (requestedMs === undefined) {
        return maxMs;
    }

    if (maxMs === undefined) {
        return requestedMs;
    }

    return Math.min(requestedMs, maxMs);
}
