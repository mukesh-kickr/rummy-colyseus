import { Card } from "../schema/Card.js";
import { isCardJoker } from "./rules.js";

export function calculatesPenaltyPoints(cards: Card[], wildJoker: Card | undefined): number{
    let points = 0;
    for (const card of cards) {
        if (wildJoker && isCardJoker(card, wildJoker)) {
            continue;
        }
        if (["J", "Q", "K", "A"].includes(card.rank)) {
            points += 10;
        } else {
            points += parseInt(card.rank);
        }
    }
    return Math.min(points, 80);
}