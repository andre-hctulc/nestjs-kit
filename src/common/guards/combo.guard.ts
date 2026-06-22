import type { CanActivate, ExecutionContext } from "@nestjs/common";

export interface ComboGuardOptions {
    /**
     * Defaults to true if mode is "AND", false if mode is "OR"
     */
    rejectErrors?: boolean;
}

class ComboGuard implements CanActivate {
    #rejectErrors: boolean;

    constructor(
        readonly mode: "AND" | "OR",
        private guards: CanActivate[],
        options?: ComboGuardOptions,
    ) {
        this.guards = [...guards];
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

export class AllGuard extends ComboGuard {
    constructor(guards: CanActivate[], options?: ComboGuardOptions) {
        super("AND", guards, options);
    }
}

export class AnyGuard extends ComboGuard {
    constructor(guards: CanActivate[], options?: ComboGuardOptions) {
        super("OR", guards, options);
    }
}
