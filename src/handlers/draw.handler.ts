import { Client } from "colyseus";
import { RummyRoom } from "../rooms/RummyRoom.js";
import { shuffle } from "../utils/suffle.js";
import { Card } from "../schema/Card.js";

export function handleDraw(room: RummyRoom, client: Client, message:any) {
    const playerId = client.sessionId;

    if (room.state.currentTurn !== playerId) {
        console.log("Not Your turn!");
        return;
    }

    const player = room.state.players.get(playerId);

    if (!player) {
        return;
    }

    if (player.hasDrawn) {
        return
    }
    if (message.source === "deck") {
        if (room.state.deck.length === 0) {
            console.log("Deck is empty! Resuffling the discard pile...");
            if (room.state.discardPile.length <= 1) {
                console.log("Not enough cards to suffle! Match ends in draw!");
                room.state.status = "finished";
                room.broadcast("result", {
                    valid: false,
                    reason: "Match ended in draw.(No cards left)"
                })
                return;
            }
            const topDiscardCard = room.state.discardPile.pop();
            const cardsToSuffle = [];
            while (room.state.discardPile.length > 0) {
                cardsToSuffle.push(room.state.discardPile.pop());

            }
            const newDeck = shuffle(cardsToSuffle);
            newDeck.forEach((card: Card) => {
                if (card) {
                    room.state.deck.push(card);
                }
            })
            if (topDiscardCard) {
                room.state.discardPile.push(topDiscardCard);
            }
        
        }
        const drawnCard = room.state.deck.pop();
        if (drawnCard) {
            player.hand.push(drawnCard);
            player.hasDrawn = true;
            console.log(`${playerId} drew a card`);
        }
    } else if (message.source === "discard") {
        if (room.state.discardPile.length === 0) {
            console.log("Discard pile is empty!");
            return;
        }
        const drawnCard = room.state.discardPile.pop();
        if (drawnCard) {
            player.hand.push(drawnCard);
            player.hasDrawn = true;
            console.log(`${playerId} drew card from discardPile!`);
        }
    } 
}