import { Schema, type } from "@colyseus/schema";

export class Card extends Schema{
    @type("string") id: string;
    @type("string") suit: string;
    @type("string") rank: string;
    @type("boolean") isJoker: boolean = false;
}