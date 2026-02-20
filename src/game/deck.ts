import { Card } from "../schema/Card.js";

const SUIT = ["hearts", "diamonds", "clubs", "spades"];
const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

let cardCounter = 0;
function createCard(suit: string, rank: string, isJoker = false): Card{
    const card = new Card()
    card.id = `${rank}-${suit}-${cardCounter++}`;
    card.suit = suit;
    card.rank = rank;
    card.isJoker = isJoker;
    return card;
}

export function generateDeck(): Card[]{
    const deck: Card[] = [];
    for (let deckIndex = 0; deckIndex < 2; deckIndex++){
        for (const suit of SUIT) {
          for (const rank of RANKS) {
            deck.push(createCard(suit, rank, false));
          }
        }

        deck.push(createCard("joker", "pj", true));
        deck.push(createCard("joker", "pj", true));

    }

    return deck;

}
export function rankValue(rank: string):number {
  return RANKS.indexOf(rank);
}
