import { Schema, type, ArraySchema } from "@colyseus/schema";
import { Card } from "./Card.js";

export class Player extends Schema {
  @type("string") sessionId: string;
  @type([Card]) hand = new ArraySchema<Card>();
  @type("boolean") isReady: boolean = false;
  @type("number") score: number = 0;
  @type("boolean") hasDeclared: boolean = false;
  @type("boolean") hasDrawn: boolean = false;
  @type("boolean") isEliminated: boolean = false;
  @type("boolean") hasSubmittedLoserDeclare: boolean = false;
}