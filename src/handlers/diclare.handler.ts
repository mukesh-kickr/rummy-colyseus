import { Client } from "colyseus";
import { RummyRoom } from "../rooms/RummyRoom.js";
import { isPureSequence, isValidSequence, isValidSet } from "../game/rules.js";
import { Card } from "../schema/Card.js";

export function handleDeclare(room: RummyRoom, client: Client, message: any) {
  const playerId = client.sessionId;

  if (room.state.currentTurn !== playerId) {
    console.log("Not your turn to declare");
    return;
  }

  const player = room.state.players.get(playerId);
  if (!player) return;

  if (!player.hasDrawn) {
    console.log("Must draw before declare");
    return;
  }

  console.log(`${playerId} declared`);
  const { melds, discardCardId } = message;

  if (!melds || melds.length === 0) {
    console.log("INVALID DECLARE: No melds provided");
    room.broadcast("result", {
      winner: playerId,
      valid: false,
      reason: "No melds provided",
    });
    return;
  }

  const declaredCardIds = new Set<string>();
  melds.forEach((meld: any[]) => {
    meld.forEach((card: Card) => declaredCardIds.add(card.id));
  })
  declaredCardIds.add(discardCardId);
  if (declaredCardIds.size !== 14 || player.hand.length !== 14) {
    console.log(`${playerId} sumbmited wrong number of cards!`)
    room.broadcast("result", {
      winner: playerId,
      valid: false,
      reason:"Invalid card count detected."
    })
    return;
  }
  const serverHandIds = new Set(player.hand.map((card: Card) => card.id));
  let ownAllCards = true;
  for (let id of declaredCardIds) {
    if (!serverHandIds.has(id)) {
      ownAllCards = false;
      break;
    }
  }
  if (!ownAllCards) {
    console.log(`${playerId} tried to declare cards they do not own!`);
    room.broadcast("result", {
      valid: false,
      winner: playerId,
      reason:"Card mismatch error!"
    })
    return;
  }

  let hasPureSequence = false;
  let allValid = true;
  for (const meld of melds) {
    if (isPureSequence(meld)) {
      hasPureSequence = true;
      break;
    }
  }

  if (!hasPureSequence) {
    console.log("INVALID DECLARE: No pure sequence");
    room.broadcast("result", {
      winner: playerId,
      valid: false,
      reason: "No pure sequence",
    });
    return;
  }

  for (const meld of melds) {
    if (!isPureSequence(meld) && !isValidSequence(meld) && !isValidSet(meld)) {
      allValid = false;
      break;
    }
  }

  if (allValid) {
    console.log("Valid declare - win!");
    const discardIndex = player.hand.findIndex(
      (c: Card) => c.id === discardCardId,
    );
    if (discardIndex !== -1) {
      const [discardedCard] = player.hand.splice(discardIndex, 1);
      room.state.discardPile.push(discardedCard);
    }

    room.state.status = "finished";
    room.broadcast("result", { winner: playerId, valid: true });
  } else {
    console.log("INVALID DECLARE: Invalid groupings");
    room.broadcast("result", {
      winner: playerId,
      valid: false,
      reason: "Invalid groupings",
    });
  }
}
