import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { DiscoveryService, Reflector } from "@nestjs/core";
import { Interactive, type InteractiveCommandDefinition } from "./interactive.decorator.js";
import { CommanderInputStream } from "./commander-input-stream.class.js";
import { program, type Command } from "commander";
import { argv } from "process";

export interface CommanderProgramOptions {
    name?: string;
    description?: string;
    input?: NodeJS.ReadableStream;
    output?: NodeJS.WritableStream;
    error?: NodeJS.WritableStream;
    outputPrefix?: string;
}

@Injectable()
export class CommanderService implements OnModuleInit {
    #logger = new Logger(CommanderService.name);
    #program: Command | undefined;
    #commander: typeof import("commander") | undefined;

    constructor(
        private discoveryService: DiscoveryService,
        private reflector: Reflector,
    ) {}

    async onModuleInit() {
        try {
            this.#commander = await import("commander");
        } catch (error) {
            this.#logger.debug(
                "Failed to load 'commander' package. Please ensure it is installed as a dependency.",
            );
            return;
        }

        this.#program = this.#createProgram();
        this.#registerCommands();
        this.#run();
    }

    async #run(): Promise<void> {
        await this.#prog().parseAsync(argv, { from: "user" });
    }

    #prog(): Command {
        if (!this.#program) {
            throw new Error("commander not initialized");
        }
        return this.#program;
    }

    #createProgram(options: CommanderProgramOptions = {}): Command {
        if (!this.#commander) {
            throw new Error("commander not initialized");
        }

        const program = new this.#commander.Command(options.name ?? "nestjs");

        program.name(options.name ?? "nestjs");
        program.description(options.description ?? "NestJS interactive CLI");
        program.configureOutput({
            writeOut: (chunk: string) => {
                this.#writePrefixedChunk(options.output ?? process.stdout, chunk);
            },
            writeErr: (chunk: string) => {
                this.#writePrefixedChunk(options.error ?? process.stderr, chunk);
            },
        });

        const input = options.input ?? new CommanderInputStream(process.stdin);
        (program as Command & { stdin?: NodeJS.ReadableStream }).stdin = input;

        return program;
    }

    #registerCommands(): Command {
        const providers = this.discoveryService.getProviders();

        for (const provider of providers) {
            const instance = provider.instance;
            if (!instance || typeof instance !== "object") {
                continue;
            }

            const definitions = this.reflector.get<Record<string, InteractiveCommandDefinition> | undefined>(
                Interactive.KEY,
                instance.constructor,
            );

            if (!definitions) {
                continue;
            }

            for (const [methodName, definition] of Object.entries(definitions)) {
                this.#addCommand(instance, methodName, definition);
            }
        }

        return this.#prog();
    }

    #writePrefixedChunk(destination: NodeJS.WritableStream, chunk: string): void {
        const prefix = "[interactive] ";
        const lines = chunk.split(/\r?\n/);
        const prefixed = lines.map((line) => `${prefix}${line}`).join("\n");
        destination.write(prefixed);
    }

    #addCommand(instance: object, methodName: string, definition: InteractiveCommandDefinition): void {
        const command = this.#prog()
            .command(definition.name)
            .description(definition.description ?? `Runs ${definition.name}`);

        for (const argument of definition.arguments) {
            command.argument(argument.flags, argument.description);
        }

        for (const option of definition.options) {
            command.option(option.flags, option.description, option.defaultValue);
        }

        command.action(async (...args: unknown[]) => {
            const commandObject = args.at(-1) as Command | undefined;
            const positionalValues = args.slice(0, -1);
            const methodArgs = positionalValues.slice(0, definition.arguments.length);
            const options = commandObject?.opts?.() ?? {};
            const handler = (instance as Record<string, (...inputs: unknown[]) => unknown>)[methodName];

            const result = await handler(...methodArgs, options);
            if (result !== undefined) {
                this.#writePrefixedChunk(process.stdout, String(result));
            }
        });

        this.#prog().addCommand(command);
    }
}
