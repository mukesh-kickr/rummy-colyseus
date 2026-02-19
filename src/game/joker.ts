import { Card } from "../schema/Card.js";

export function selectWildJoker(deck: Card[]): Card{
    const jokerCard = deck[Math.floor(Math.random() * deck.length)];

    return jokerCard;
}

export function applyWildJoker(deck: Card[], wildRank: string) {
  for (const card of deck) {
    if (card.rank === wildRank) {
      card.isJoker = true;
    }
  }
}
