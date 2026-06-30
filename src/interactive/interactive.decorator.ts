import "reflect-metadata";

export interface InteractiveArgumentDefinition {
    flags: string;
    description?: string;
}

export interface InteractiveOptionDefinition {
    flags: string;
    description?: string;
    defaultValue?: string | boolean | string[];
}

export interface InteractiveCommandDefinition {
    name: string;
    description?: string;
    arguments: InteractiveArgumentDefinition[];
    options: InteractiveOptionDefinition[];
}

export function Interactive(options: Partial<InteractiveCommandDefinition> = {}): MethodDecorator {
    return (target, propertyKey) => {
        const methodName = propertyKey.toString();
        const metadataTarget = target.constructor;
        const existingDefinitions = Reflect.getMetadata(Interactive.KEY, metadataTarget) ?? {};
        existingDefinitions[methodName] = {
            name: options.name ?? methodName,
            description: options.description,
            arguments: options.arguments ?? [],
            options: options.options ?? [],
        };

        Reflect.defineMetadata(Interactive.KEY, existingDefinitions, metadataTarget);
    };
}

Interactive.KEY = Symbol("nestjs-kit:interactive-command");
