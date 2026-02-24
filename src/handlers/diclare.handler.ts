import { Client} from "colyseus";
import { RummyRoom } from "../rooms/RummyRoom.js";
import { calculatesLoserPenalty, isPureSequence, isValidSequence, isValidSet } from "../game/rules.js";
import { Card } from "../schema/Card.js";
import { Player } from "../schema/Player.js";

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

    room.state.status = "loser_declaring";
    player.hasSubmittedLoserDeclare = true;
    room.broadcast("winner_declared", {
      winner: playerId,
      message:
        "A winner has been declared! You have 30 seconds to group your cards.",
    });

    room.clock.setTimeout(() => {
      if (room.state.status === "loser_declaring") {
        finalizeRound(room, playerId, wildJoker); 
      }
    }, 30000);
  } else {
    console.log("INVALID DECLARE: Invalid groupings");
    room.broadcast("result", {
      winner: playerId,
      valid: false,
      reason: "Invalid groupings",
    });
  }
}

export function handleLoserDeclare(room: RummyRoom, client: Client, message: any) {
  if (room.state.status !== "loser_declaring") {
    return;
  }
  const player:Player = room.state.players.get(client.sessionId);
  if (!player || player.hasSubmittedLoserDeclare) {
    return;
  }
  const { melds, leftovers } = message;
  const penalty = calculatesLoserPenalty(melds, leftovers, room.state.wildJoker);
  (player as any).tempPenalty = penalty;
  player.hasSubmittedLoserDeclare = true;
  let allDone = true;
  room.state.players.forEach((p:Player) => {
    if (!p.isEliminated && !p.hasSubmittedLoserDeclare) {
      allDone = false;
    }
  })
  if (allDone) {
    finalizeRound(room, client.sessionId, room.state.wildJoker);
  }
}

export function finalizeRound( room: RummyRoom, triggerPlayerId: string, wildJoker: any,) {
  if (room.state.status !== "loser_declaring") {
    return;
  }
  room.state.status = "finished";

  const roundScores: Record<string, number> = {};
  const POOL_LIMIT = 101;
  let activePlayersCount = 0;
  let lastPlayerStanding = "";
  let actualWinnerId = "";

  room.state.players.forEach((p: Player, id: string) => {
    if (
      !p.isEliminated &&
      p.hasSubmittedLoserDeclare &&
      (p as any).tempPenalty === undefined
    ) {
      actualWinnerId = id;
    }
  });

  room.state.players.forEach((player: any, id: string) => {
    if (player.isEliminated) return;

    if (id === actualWinnerId) {
      roundScores[id] = 0;
    } else {
     
      const finalPenalty =
        player.tempPenalty !== undefined ? player.tempPenalty : 80;
      player.score += finalPenalty;
      roundScores[id] = finalPenalty;

      if (player.score >= POOL_LIMIT) {
        player.isEliminated = true;
        console.log(`${id} eliminated!`);
      }
    }

    player.hasSubmittedLoserDeclare = false;
    player.tempPenalty = undefined;

    if (!player.isEliminated) {
      activePlayersCount++;
      lastPlayerStanding = id;
    }
  });

  const isMatchOver = activePlayersCount <= 1;

  room.broadcast("result", {
    winner: actualWinnerId,
    valid: true,
    roundScores: roundScores,
    isMatchOver: isMatchOver,
    grandWinner: isMatchOver ? lastPlayerStanding : null,
  });

  if (isMatchOver) {
    room.clock.setTimeout(() => room.disconnect(), 10000);
  }
};