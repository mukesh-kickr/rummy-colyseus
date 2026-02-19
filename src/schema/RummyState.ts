import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { Player } from "./Player.js";
import { Card } from "./Card.js";

export class RummyState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();

  @type([Card]) deck = new ArraySchema<Card>();
  @type([Card]) discardPile = new ArraySchema<Card>();

  @type("string") currentTurn: string;

  @type(Card) wildJoker: Card;

  @type("string") status: string = "waiting";

  @type("number") turnTimeRemaining: number = 0;
}