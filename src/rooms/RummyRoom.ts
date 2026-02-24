import { Room, Client, Delayed } from "colyseus";
import { RummyState } from "../schema/RummyState.js";
import { Player } from "../schema/Player.js";
import { generateDeck } from "../game/deck.js";
import { shuffle } from "../utils/suffle.js";
import { selectWildJoker, applyWildJoker } from "../game/joker.js";
import { handleDraw } from "../handlers/draw.handler.js";
import { handleDiscard } from "../handlers/discard.handler.js";
import { handleDeclare, handleLoserDeclare } from "../handlers/diclare.handler.js";

export class RummyRoom extends Room<RummyState> {
  private turnOrder: string[] = [];
  private turnInterval!: Delayed;
  private readonly TURN_TIME_SECONDS = 30;


  onCreate(options: any): void | Promise<any> {
    this.setState(new RummyState());
    this.maxClients = options.maxPlayers || 2;
    console.log("Rummy Room created!");

    this.onMessage("start", (client) => {
      console.log("start called");
      console.log("Start request from ", client.sessionId);
      this.tryStartGame();
    });
    this.onMessage("draw", (client, message) => {
      handleDraw(this, client, message);
    });
    this.onMessage("discard", (client, message) => {
      console.log("Discard received from", client.sessionId);
      handleDiscard(this, client, message);
      if (this.state.currentTurn !== client.sessionId && this.state.status === "playing") {
        this.startTurnTimer();
      }
    });
    this.onMessage("declare", (client, message) => {
      console.log("Declared payload recieved : ", message)
      handleDeclare(this, client, message);
      if (this.state.status === "finished" && this.turnInterval) {
        this.turnInterval.clear();
      }
    })
    this.onMessage("playAgain", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = true;
        console.log(`${client.sessionId} is again ready to play`)
        this.checkRestartGame();
      }
    })

    this.onMessage("loser_declare", (client, message) =>
      handleLoserDeclare(this, client, message),
    );
  }

  onJoin(client: Client<any>, options?: any, auth?: any): void | Promise<any> {
    console.log(client.sessionId, "joined");

    const player = new Player();
    player.sessionId = client.sessionId;

    this.state.players.set(client.sessionId, player);

    if (this.clients.length === this.maxClients) {
      console.log("Two players ready");

      this.tryStartGame();
    }
  }

  async onLeave(client: Client, consented: boolean) {
    const player:Player = this.state.players.get(client.sessionId)
    if (!player) {
      return;
    }
    if(!consented)
    {
      try {
        console.log(`Waiting 20s for ${client.sessionId} to reconnect`);
        const reconnectedClient = await this.allowReconnection(client, 20);
        console.log(`${reconnectedClient.sessionId} reconnected!`);
      } catch (error) {
        console.log(`${client.sessionId} failed to reconnect.`);
      }
    }
    console.log(`${client.sessionId} permanently left the game. Consented:${consented}`)
    player.isEliminated = true;
    player.score += 80;
    this.turnOrder = this.turnOrder.filter((id) => id !== client.sessionId);
    if (this.state.currentTurn === client.sessionId && this.state.status === "playing") {
      if (this.turnInterval) {
        this.turnInterval.clear();
      }
      this.nextTurn();
    }
    this.checkGameOver();
  }

  tryStartGame() {
    if (this.state.status !== "waiting") {
      return;
    }
    if (this.state.players.size < this.maxClients) {
      return;
    }

    console.log("Starting game");
    this.state.status = "dealing";
    this.initializeGame();
  }

  initializeGame() {
    this.state.players.forEach((player:Player,id:string) => {
      player.hand.splice(0, player.hand.length);
      player.isReady = false;
      player.hasDrawn = false;
      player.hasDeclared = false;
      if (!player.isEliminated) {
        this.turnOrder.push(id);
      }
    });
    this.state.deck.splice(0, this.state.deck.length);
    this.state.discardPile.splice(0,this.state.discardPile.length);
    const rawDeck = generateDeck();
    // console.log(" Deck : ", rawDeck);
    const suffledDeck = shuffle(rawDeck);
    // console.log("suffled Deck : ", suffledDeck);

    const wildJoker = selectWildJoker(suffledDeck);
    applyWildJoker(suffledDeck, wildJoker.rank);
    this.state.wildJoker = wildJoker;
    suffledDeck.forEach((card) => this.state.deck.push(card));

    this.dealCards();
    //   console.log(this.state.players.get(this.clients[0].sessionId)?.hand);
    //   console.log(this.state.players.get(this.clients[1].sessionId)?.hand);
    const firstOpenCard = this.state.deck.pop();
    if (firstOpenCard) {
      this.state.discardPile.push(firstOpenCard);
    }
    this.turnOrder = Array.from(this.state.players.keys());
    this.state.currentTurn = this.turnOrder[0];
    this.state.status = "playing";
    this.startTurnTimer();
    console.log("Game initialized");
  }

  dealCards() {
    const playerIds = Array.from(this.state.players.keys());
    console.log("Dealing to players:", playerIds);
    for (let i = 0; i < 13; i++) {
      for (let playerId of playerIds) {
        const card = this.state.deck.pop();
        if (!card) {
          continue;
        }
        const player = this.state.players.get(playerId);
        player?.hand.push(card);
      }
    }
    playerIds.forEach((id) => {
      const player = this.state.players.get(id);
      console.log("Player hand count:", id, player?.hand.length);
    });
  }

  nextTurn() {
    if (this.turnOrder.length === 0) {
      return;
    }
    const currentIndex = this.turnOrder.indexOf(this.state.currentTurn);
    const nextIndex = (currentIndex + 1) % this.turnOrder.length;
    const nextPlayerId = this.turnOrder[nextIndex];
    const nextPlayer = this.state.players.get(nextPlayerId);
    if (nextPlayer) {
      nextPlayer.hasDrawn = false;
    }
    this.state.currentTurn = nextPlayerId;

    console.log("Turn switched to:", nextPlayerId);
    this.startTurnTimer();
  }
  checkRestartGame() {
    if (this.state.status !== "finished") {
      return;
    }
    let readyCount = 0;
    let aliveCount = 0;
    this.state.players.forEach((player:Player) => {
      if (!player.isEliminated) {
        aliveCount += 1;
        if (player.isReady) {
          readyCount += 1;
        }
      }
    })
    if (readyCount === aliveCount && aliveCount >1) {
      this.restartGame();
    }
  }
  restartGame() {
    console.log("Restarting game.. .")
    this.state.status = "dealing";
    this.initializeGame();
  }
  
  startTurnTimer() {
    this.state.turnTimeRemaining = this.TURN_TIME_SECONDS;
    if (this.turnInterval) {
      this.turnInterval.clear();
    }
    this.turnInterval = this.clock.setInterval(() => {
      if (this.state.status !== "playing") {
        this.turnInterval.clear();
        return;
      }
      this.state.turnTimeRemaining -= 1;
      if (this.state.turnTimeRemaining <= 0) {
        this.handleTimeout();
      }
    },1000)
  }
  handleTimeout() {
    const currentPlayerId = this.state.currentTurn;
    const player = this.state.players.get(currentPlayerId);
    if (!player) {
      return
    }
      console.log(`Times up for ${currentPlayerId}`);
      if (!player.hasDrawn) {
        const drawnCard = this.state.deck.pop();
        if (drawnCard) {
          player.hand.push(drawnCard);
          player.hasDrawn = true;
        }
      }
    if (player.hand.length > 0) {
      const randomIndex = Math.floor(Math.random() * player.hand.length);
      const [discardedCard] = player.hand.splice(randomIndex, 1);
      if (discardedCard) {
        this.state.discardPile.push(discardedCard);
        console.log(`Discarded ${discardedCard.rank} of ${discardedCard.suit}`);
      }
    }
    player.hasDrawn = false;
    this.nextTurn();
    
  }
  checkGameOver() {
    let activePlayersCount = 0;
    let lastPlayerStanding = "";
    this.state.players.forEach((player: Player, id: string) => {
      if (!player.isEliminated) {
        activePlayersCount++;
        lastPlayerStanding = id;
      }
    })
    if (activePlayersCount === 1 && this.state.status !== "match_over") {
      console.log(`MATCH OVER! ${lastPlayerStanding} win the match`)
      if (this.turnInterval) {
        this.turnInterval.clear();
      }
      this.state.status = "match_over";
      this.broadcast("result", {
        winner: lastPlayerStanding,
        valid: true,
        isMatchOver: true,
        grandWinner: lastPlayerStanding,
        reason: `All other players were eliminated or abandoned the match.`,
      });
      this.clock.setTimeout(() => {
        this.disconnect()
      }, 1000)
    }
  }
}

