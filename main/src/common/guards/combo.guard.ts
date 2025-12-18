import type { CanActivate } from "@nestjs/common";

export interface ComboGuardOptions {
    /**
     * @default "AND"
     */
    mode?: "AND" | "OR";
    rejectErrors?: boolean;
}

export class ComboGuard implements CanActivate {
    readonly mode: "AND" | "OR";
    #rejectErrors: boolean;

    constructor(private readonly guards: CanActivate[], options?: ComboGuardOptions) {
        this.guards = [...this.guards];
        this.mode = options?.mode ?? "AND";
        this.#rejectErrors = options?.rejectErrors ?? true;
        if (!guards.length) {
            throw new Error("ComboGuard requires at least one guard");
        }
    }

    async canActivate(context: any): Promise<boolean> {
        const orMode = this.mode === "OR";

        for (const guard of this.guards) {
            try {
                const canActivate = await guard.canActivate(context);
                if (!canActivate && !orMode) {
                    return false;
                }
            } catch (err) {
                if (this.#rejectErrors) {
                    throw err;
                }
                if (!orMode) {
                    return false;
                }
            }
        }

        return false;
    }
}
