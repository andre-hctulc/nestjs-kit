import { Readable, type ReadableOptions } from "stream";

export class CommanderInputStream extends Readable {
    private readonly source: NodeJS.ReadableStream;

    constructor(source: NodeJS.ReadableStream = process.stdin, options?: ReadableOptions) {
        super(options);
        this.source = source;
        this.attach();
    }

    private attach(): void {
        if (typeof this.source.on !== "function") {
            return;
        }

        this.source.on("data", (chunk: string | Buffer) => {
            this.push(chunk);
        });
        this.source.on("end", () => {
            this.push(null);
        });
        this.source.on("error", (error: Error) => {
            this.destroy(error);
        });
    }
}
