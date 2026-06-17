import type { CanActivate, ExecutionContext } from "@nestjs/common";

export interface ComboGuardOptions {
    /**
     * @default "AND"
     */
    mode?: "AND" | "OR";
    /**
     * Defaults to true if mode is "AND", false if mode is "OR"
     */
    rejectErrors?: boolean;
}

export class ComboGuard implements CanActivate {
    readonly mode: "AND" | "OR";
    #rejectErrors: boolean;

    constructor(private readonly guards: CanActivate[], options?: ComboGuardOptions) {
        this.guards = [...guards]; // Fix: copy from parameter, not from uninitialized property
        this.mode = options?.mode ?? "AND";
        this.#rejectErrors = options?.rejectErrors ?? this.mode === "AND";
        if (!guards.length) {
            throw new Error("ComboGuard requires at least one guard");
        }
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isOrMode = this.mode === "OR";

        for (const guard of this.guards) {
            try {
                const canActivate = await guard.canActivate(context);

                if (isOrMode) {
                    // OR mode: return true if any guard passes
                    if (canActivate) {
                        return true;
                    }
                } else {
                    // AND mode: return false if any guard fails
                    if (!canActivate) {
                        return false;
                    }
                }
            } catch (err) {
                if (this.#rejectErrors) {
                    throw err;
                }

                if (isOrMode) {
                    // OR mode: continue to next guard on error
                    continue;
                } else {
                    // AND mode: return false on error
                    return false;
                }
            }
        }

        // Return true for AND mode (all guards passed) or false for OR mode (no guard passed)
        return !isOrMode;
    }
}
