import { Card } from "../schema/Card.js";
import { rankValue } from "./deck.js";

export function isPureSequence(cards:Card[]):boolean {
    if (cards.length < 3) {
        return false;
    }
    const nonJokers = cards.filter((card) => !card.isJoker);
    if (nonJokers.length === 0) {
        return false;
    }
    const suit = nonJokers[0].suit;
    for (let card of cards) {
        if (suit !== card.suit) {
            return false;
        }
        if (card.isJoker) {
            return false;
        }
    }

    return isConsecutive(cards);
}

export function isConsecutive(cards: Card[]): boolean{
    const sorted = [...cards].sort((a, b) => rankValue(a.rank) - rankValue(b.rank));
    for (let i = 1; i < sorted.length; i++){
        const diff = rankValue(sorted[i].rank) - rankValue(sorted[i - 1].rank);
        if (diff !== 1) {
            return false;
        }
    }
    return true;
}

export function isValidSequence(cards:Card[]):boolean {
    if (cards.length < 3) {
        return false;
    }

    
    const nonJokers = cards.filter((card) => !card.isJoker);
    if (nonJokers.length === 0) {
        return false;
    }
    const suit = nonJokers[0].suit;
    if (!nonJokers.every((card) => card.suit === suit)) {
        return false;
    }

    return canFormConsecutiveWithJokers(cards);
}

export function canFormConsecutiveWithJokers(cards: Card[]): boolean{
    
    const jokers = cards.filter((card) => card.isJoker);
    const nonJokers = cards.filter((card) => !card.isJoker);

    if (nonJokers.length === 0) {
        return true;
    }
    const sorted = [...nonJokers].sort((a, b) => rankValue(a.rank) - rankValue(b.rank));
    let requiredJokers = 0;
    for (let i = 1; i < sorted.length; i++){
        const diff = rankValue(sorted[i].rank) - rankValue(sorted[i - 1].rank);
        if (diff === 0) {
            return false;
        }
        if (diff > 1) {
            requiredJokers += (diff - 1);
        }
    }

    return jokers.length >= requiredJokers;

}

export function isValidSet(cards: Card[]): boolean{
    if (cards.length < 3 || cards.length > 4) {
        return false;
    }
    const nonJokers = cards.filter((card) => !card.isJoker);
    if (nonJokers.length === 0) {
        return false;
    }
    const rank = nonJokers[0]?.rank;
    if (!nonJokers.every((card) => card.rank === rank)) {
        return false;
    }
    const suits = new Set(nonJokers.map((card) => card.suit));
    return suits.size === nonJokers.length;
}
export function isValidHand(hand: Card[], wildJoker: Card) { 
    const groups = autoGroup(hand);
    let hasPureSequence = false;
    for (let group of groups) {
        if (isPureSequence(group)) {
            hasPureSequence = true;
        }
    }
    if (!hasPureSequence) {
        return {valid:false, reason:"No pure sequence"}
    }
    const allValid = groups.every((group) =>
        isPureSequence(group) ||
        isValidSequence(group) ||
        isValidSet(group)
    )
    if (!allValid) {
      return { valid: false, reason: "Invalid grouping" };
    }

    return { valid: true };
}
    
export function autoGroup(hand: Card[]) {
    const cards = [...hand]
    const groups: any[][] = [];
    extractGroups(cards, groups, isPureSequence);
    extractGroups(cards, groups, isValidSequence);
    extractGroups(cards, groups, isValidSet);
    if (cards.length > 0) {
        groups.push(cards)
    }

    return groups;
    
}

function extractGroups(
  cards: Card[],
  groups: Card[][],
  validator: (group: Card[]) => boolean,
) {
  let found = true;

  while (found) {
    found = false;

    for (let size = 3; size <= cards.length; size++) {
      for (let i = 0; i <= cards.length - size; i++) {
        const attempt = cards.slice(i, i + size);

        if (validator(attempt)) {
          groups.push(attempt);
          removeCards(cards, attempt);
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }
}

function removeCards(cards: Card[], toRemove: Card[]) {
    toRemove.forEach((card) => {
        const index = cards.findIndex((c) => c.id === card.id)
        if (index !== -1) {
            cards.splice(index, 1);
        }
    })
}