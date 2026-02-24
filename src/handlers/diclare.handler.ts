import { Client } from "colyseus";
import { RummyRoom } from "../rooms/RummyRoom.js";
import { isPureSequence, isValidSequence, isValidSet } from "../game/rules.js";
import { Card } from "../schema/Card.js";
import { Player } from "../schema/Player.js";
import { calculatesPenaltyPoints } from "../game/score.js";

export function handleDeclare(room: RummyRoom, client: Client, message: any) {
  const playerId = client.sessionId;
  const wildJoker = room.state.wildJoker;
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
  let pureSequenceCount = 0;
  let totalSequenceCount = 0;
  let allValid = true;
  for (const meld of melds) {
    if (isPureSequence(meld)) {
      pureSequenceCount++;
      totalSequenceCount++;
      
    } else if (isValidSequence(meld, wildJoker)) {
      totalSequenceCount++;
    } else if (!isValidSet(meld, wildJoker)) {
      allValid = false;
      break;
    }
  }
  if (pureSequenceCount === 0) {
    console.log(`INVALID DECLARE: No pure sequences`);
    room.broadcast("result", {
      winner: playerId,
      valid: false,
      reason: "You need at least one Pure Sequence.",
    });
    return;
  }
  if (totalSequenceCount < 2) {
  console.log("INVALID DECLARE: Not enough sequences");
  room.broadcast("result", {
    winner: playerId,
    valid: false,
    reason: "You must have at least TWO sequences (one pure, one pure/impure).",
  });
  return;
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
    const roundScores: Record<string, number> = {};
    const POOL_LIMIT = 101;
    let activePlayersCount = 0;
    let lastPlayerStanding = ""
    room.state.players.forEach((player: Player, id: string) => {
      if (player.isEliminated) {
        return;
      }
      if (id === playerId) {
        roundScores[id] = 0;

      } else {
        const penalty = calculatesPenaltyPoints(Array.from(player.hand), wildJoker);
        player.score += penalty;
        roundScores[id] = penalty;
        if (player.score >= POOL_LIMIT) {
          player.isEliminated = true;
          console.log("Player eliminated:", id);
        }
      }
      if (!player.isEliminated) {
        activePlayersCount++;
        lastPlayerStanding = id;
      }
    })
    const isMatchOver = activePlayersCount <= 1;
    room.broadcast("result", {
      winner: playerId,
      valid: true,
      roundScores: roundScores,
      isMatchOver: isMatchOver,
      grandWinner: isMatchOver ?lastPlayerStanding:null
    });

    if (isMatchOver) {
      room.clock.setTimeout(() => {
        room.disconnect();
      }, 10000);
    }
  } else {
    console.log("INVALID DECLARE: Invalid groupings");
    room.broadcast("result", {
      winner: playerId,
      valid: false,
      reason: "Invalid groupings",
    });
  }
}
