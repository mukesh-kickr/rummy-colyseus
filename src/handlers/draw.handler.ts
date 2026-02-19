import { Client } from "colyseus";
import { RummyRoom } from "../rooms/RummyRoom.js";

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
    let drawnCard;
    if (message.source === "deck") {
        drawnCard = room.state.deck.pop();

        if (!drawnCard) {
          console.log("Deck empty");
          return;
        }
    } else if (message.source === "discard") {
        drawnCard = room.state.discardPile.pop();
        if (!drawnCard) {
          console.log("Discard empty");
          return;
        }
    } else {
        console.log("Invalid draw source");
        return;
    }

    player.hand.push(drawnCard);
    player.hasDrawn = true;
    console.log(`${playerId} drew ${drawnCard.rank} ${drawnCard.suit}`);
}