import { DEV_MODE } from "./system/system.util.js";

/**
 * Get env files based on the current environment:
 * - `development` - *.env.development.local*, *.env.local*, *.env.development*, *.env*
 * - `production` - *.env.production.local*, *.env.local*, *.env.production*, *.env*
 */
export function getEnvFiles(): string[] {
    return DEV_MODE
        ? [".env.development.local", ".env.local", ".env.development", ".env"]
        : [".env.production.local", ".env.local", ".env.production", ".env"];
}
