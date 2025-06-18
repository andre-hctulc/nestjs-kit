import { Injectable, InternalServerErrorException } from "@nestjs/common";
import path from "path";
import { readFileSync } from "fs";
import { hasKeys } from "../util/system/system-util.js";

@Injectable()
export class InputLoaderService {
    private baseDir: string = "./";

    setBaseDir(dir: string): void {
        this.baseDir = dir;
    }

    private staticTemplates: Record<string, string> = {};

    injectParams(text: string, params: Record<string, any>): string {
        return Object.entries(params).reduce((result, [key, value]) => {
            const placeholder = `{{${key}}}`;
            return result.replace(new RegExp(placeholder, "g"), String(value));
        }, text);
    }

    loadTemplate(relPath: string, params?: Record<string, any>, forceCache = false): string {
        if (path.isAbsolute(relPath)) {
            throw new InternalServerErrorException("InputLoader: Relative path expected");
        }

        const staticTemplate = !params || !hasKeys(params);
        const cacheKey = staticTemplate
            ? relPath
            : forceCache
            ? `${relPath}-${JSON.stringify(params)}`
            : undefined;

        if (cacheKey && this.staticTemplates[cacheKey]) {
            return this.staticTemplates[cacheKey];
        }

        const p = path.join(this.baseDir, relPath);
        const fileContent = readFileSync(p, "utf-8");
        if (!fileContent) {
            throw new InternalServerErrorException("InputLoader: Failed to load file");
        }
        const text = params ? this.injectParams(fileContent, params) : fileContent;

        if (cacheKey) {
            this.staticTemplates[cacheKey] = text;
        }

        return text;
    }
}
