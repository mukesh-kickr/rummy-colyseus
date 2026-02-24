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
    const sortedLow = [...cards].sort((a, b) => rankValue(a.rank) - rankValue(b.rank));
    let isLowValid = true;
    for (let i = 1; i < sortedLow.length; i++){
        const diff = rankValue(sortedLow[i].rank) - rankValue(sortedLow[i - 1].rank);
        if (diff !== 1) {
            isLowValid = false;
            break;
        }
    }
    if (isLowValid) {
        return true;
    } 

    const sortedHigh = [...cards].sort((a, b) => highRankValue(a.rank) - highRankValue(b.rank));
    let isHighValid = true;
    for (let i = 1; i < sortedHigh.length; i++) {
      const diff =
        rankValue(sortedHigh[i].rank) - rankValue(sortedHigh[i - 1].rank);
      if (diff !== 1) {
        isHighValid = false;
        break;
      }
    }

    return isHighValid;
}

export function isValidSequence(cards:Card[], wildJoker:Card):boolean {
    if (cards.length < 3) {
        return false;
    }

    
    const nonJokers = cards.filter((card) => !isCardJoker(card, wildJoker));
    if (nonJokers.length === 0) {
        return false;
    }
    const suit = nonJokers[0].suit;
    if (!nonJokers.every((card) => card.suit === suit)) {
        return false;
    }

    return canFormConsecutiveWithJokers(cards,wildJoker);
}

export function canFormConsecutiveWithJokers(cards: Card[],wildJoker:Card): boolean{
    
    const jokers = cards.filter((card) => isCardJoker(card, wildJoker));
    const nonJokers = cards.filter((card) => !isCardJoker(card,wildJoker));

    if (nonJokers.length === 0) {
        return true;
    }
    const checkSequence = (useAceHigh: boolean) => {
        const getValue = (rank: string) => useAceHigh && rank === "A" ? 13 : rankValue(rank);
        const sorted = [...nonJokers].sort((a, b) => getValue(a.rank) - getValue(b.rank))
        let jokersRequired = 0;
        for (let i = 1; i < sorted.length; i++){
            let diff = getValue(sorted[i].rank) - getValue(sorted[i - 1].rank);
            if (diff === 0) {
                return false;
            }
            if (diff > 1) {
                jokersRequired += (diff - 1);
            }
        }
        return jokers.length >= jokersRequired;
    }
    return checkSequence(false) || checkSequence(true);

}

export function isValidSet(cards: Card[],wildJoker:Card): boolean{
    if (cards.length < 3 || cards.length > 4) {
        return false;
    }
    const nonJokers = cards.filter((card) => !isCardJoker(card, wildJoker));
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
function highRankValue(rank: string): number{
    return rank === "A" ? 13 : rankValue(rank);
}
export function isCardJoker(card: Card, wildJoker?: Card) {
    if (card.isJoker) {
        return true;
    }
    if (wildJoker && card.rank === wildJoker.rank) {
        return true;
    }
    return false;
}

export function calculatesLoserPenalty(melds: Card[][], leftoverCards: Card[], wildJoker: Card): number{
    let pureSequenceCount = 0;
    let totalSequenceCount = 0;
    let penalty = 0;
    const sumCards = (cards: Card[]) => {
        let pts = 0;
        for (const card of cards) {
            if (wildJoker && isCardJoker(card, wildJoker)) {
                continue;
            }
            if (["A", "K", "J", "Q"].includes(card.rank)) {
                pts += 10;
            } else {
                pts += parseInt(card.rank);
            }
        }
        return pts;
    }

    for (const meld of melds) {
        if (isPureSequence(meld)) {
            pureSequenceCount++;
            totalSequenceCount++;
        } else if (isValidSequence(meld, wildJoker)) {
            totalSequenceCount++;
        }
    }
    penalty += sumCards(leftoverCards);
    if (pureSequenceCount === 0) {
        for (const meld of melds) {
            penalty += sumCards(meld);
        }
        return Math.min(penalty, 80);
    }
    if (totalSequenceCount < 2) {
        for (const meld of melds) {
            if (!isPureSequence(meld)) {
                penalty += sumCards(meld);
            }
        }
        return Math.min(penalty, 80);
    }
    for (const meld of melds) {
        if (!isPureSequence(meld) && !isValidSequence(meld, wildJoker) && !isValidSet(meld, wildJoker)) {
            penalty += sumCards(meld);
        }
    }
    return Math.min(penalty, 80);
}