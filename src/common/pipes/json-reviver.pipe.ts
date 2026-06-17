import { type PipeTransform } from "@nestjs/common";

/*
We do not use a decorator, 
as json req bodies are always parsed anyways by nest and we cannot access the raw json string.
*/

export class JsonReviverPipe implements PipeTransform {
    constructor(private reviver: (key: string, value: any) => any) {}

    transform(value: any) {
        // TODO improve
        return JSON.parse(JSON.stringify(value), this.reviver);
    }
}
