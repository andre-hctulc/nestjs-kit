import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

/*
We do not use a decorator, 
as json req bodies are always parsed anyways by nest and we cannot access the raw json string.
*/

@Injectable()
export class JsonReviverPipe implements PipeTransform {
    constructor(private reviver: (key: string, value: any) => any) {}

    transform(value: any) {
        try {
            return JSON.parse(JSON.stringify(value), this.reviver);
        } catch (error) {
            throw new BadRequestException("Invalid JSON format");
        }
    }
}
