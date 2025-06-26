import { Injectable } from "@nestjs/common";
import path from "path";
import { readFileSync } from "fs";

@Injectable()
export class InputLoaderService {
    private baseDir: string = path.resolve();

    setBaseDir(dir: string): this {
        if (!path.isAbsolute(dir)) {
            throw new Error("Absolute path expected for base directory");
        }
        this.baseDir = dir;
        return this;
    }

    private staticTemplates: Record<string, string> = {};

    injectParams(text: string, params: Record<string, any>): string {
        return Object.entries(params).reduce((result, [key, value]) => {
            const placeholder = `{{${key}}}`;
            return result.replace(new RegExp(placeholder, "g"), String(value));
        }, text);
    }

    loadTemplate(relPath: string, params?: Record<string, any>, useCache = false): string {
        if (path.isAbsolute(relPath) || relPath.includes("..")) {
            throw new Error("InputLoader: Relative path expected without '..'");
        }

        const cacheKey = useCache ? `${relPath}${params ? "-p-" + JSON.stringify(params) : ""}` : undefined;

        if (cacheKey && this.staticTemplates[cacheKey]) {
            return this.staticTemplates[cacheKey];
        }

        const p = path.join(this.baseDir, relPath);
        let fileContent: string;

        try {
            fileContent = readFileSync(p, "utf-8");
        } catch (err) {
            throw new Error(`InputLoader: Error reading file at ${p}: ${(err as Error).message}`);
        }

        const text = params ? this.injectParams(fileContent, params) : fileContent;

        if (cacheKey) {
            this.staticTemplates[cacheKey] = text;
        }

        return text;
    }

    loadTemplateWithCache(relPath: string, params?: Record<string, any>): string {
        return this.loadTemplate(relPath, params, true);
    }
}
