import { Client } from "colyseus";
import { RummyRoom } from "../rooms/RummyRoom.js";
import { Card } from "../schema/Card.js";

export function handleDiscard(room: RummyRoom, client: Client, message: any) {
  console.log("Trying to discard:", message.cardId);

  const playerId = client.sessionId;

  if (room.state.currentTurn !== playerId) {
    console.log("Not your turn!");
    return;
  }

  const player = room.state.players.get(playerId);
  if (!player) return;

  console.log(
    "Player hand:",
    player.hand.map((card: Card) => card.id),
  );

  if (!player.hasDrawn) {
    console.log("Must draw before discard");
    return;
  }

  const cardIndex = player.hand.findIndex(
    (card: Card) => card.id === message.cardId,
  );
  if (cardIndex === -1) {
    console.log("Card not in hand");
    return;
  }

  const [discardedCard] = player.hand.splice(cardIndex, 1);
  if (!discardedCard) return;

  room.state.discardPile.push(discardedCard);

  console.log(
    `${playerId} discarded ${discardedCard.rank} ${discardedCard.suit}`,
  );

  console.log("Before switch:", room.state.currentTurn);

  try {
    player.hasDrawn = false;
    room.nextTurn();
  } catch (error: any) {
    console.error("Turn switch crash:", error.message);
  }

  console.log("After switch:", room.state.currentTurn);
}
