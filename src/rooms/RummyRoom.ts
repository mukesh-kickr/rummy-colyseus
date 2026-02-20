import { Room, Client } from "colyseus";
import { RummyState } from "../schema/RummyState.js";
import { Player } from "../schema/Player.js";
import { generateDeck } from "../game/deck.js";
import { shuffle } from "../utils/suffle.js";
import { selectWildJoker, applyWildJoker } from "../game/joker.js";
import { handleDraw } from "../handlers/draw.handler.js";
import { handleDiscard } from "../handlers/discard.handler.js";
import { handleDeclare } from "../handlers/diclare.handler.js";

export class RummyRoom extends Room<RummyState> {
  maxClients: number = 2;

  onCreate(options: any): void | Promise<any> {
    this.setState(new RummyState());
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
    });
    this.onMessage("declare", (client, message) => {
      console.log("Declared payload recieved : ", message)
      handleDeclare(this, client, message);
    })
  }

  onJoin(client: Client<any>, options?: any, auth?: any): void | Promise<any> {
    console.log(client.sessionId, "joined");

    const player = new Player();
    player.sessionId = client.sessionId;

    this.state.players.set(client.sessionId, player);

    if (this.clients.length === 2) {
      console.log("Two players ready");

      this.tryStartGame();
    }
  }

  onLeave(client: Client) {
    console.log(client.sessionId, "left");

    this.state.players.delete(client.sessionId);

    if (this.clients.length < 2) {
      this.state.status = "waiting";
      this.state.currentTurn = "";

      console.log("Game paused — waiting for second player");
    }
  }

  tryStartGame() {
    if (this.state.status !== "waiting") {
      return;
    }
    if (this.state.players.size < 2) {
      return;
    }

    console.log("Starting game");
    this.state.status = "dealing";
    this.initializeGame();
  }

  initializeGame() {
    const rawDeck = generateDeck();
    // console.log(" Deck : ", rawDeck);
    const suffledDeck = shuffle(rawDeck);
    // console.log("suffled Deck : ", suffledDeck);

    const wildJoker = selectWildJoker(suffledDeck);
    applyWildJoker(suffledDeck, wildJoker.rank);
    this.state.wildJoker = wildJoker;

    this.state.deck.clear();
    suffledDeck.forEach((card) => this.state.deck.push(card));

    this.dealCards();
    //   console.log(this.state.players.get(this.clients[0].sessionId)?.hand);
    //   console.log(this.state.players.get(this.clients[1].sessionId)?.hand);
    const firstOpenCard = this.state.deck.pop();
    if (firstOpenCard) {
      this.state.discardPile.push(firstOpenCard);
    }

    this.state.currentTurn = this.clients[0].sessionId;
    this.state.status = "playing";
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
    const playerIds = Array.from(this.state.players.keys());

    if (playerIds.length !== 2) {
      console.log("Turn switch requires 2 players");
      return;
    }

    const nextPlayerId = playerIds.find((id) => id !== this.state.currentTurn);

    if (!nextPlayerId) {
      console.log("Opponent not found");
      return;
    }
    const nextPlayer = this.state.players.get(nextPlayerId);
    if (nextPlayer) {
      nextPlayer.hasDrawn = false;
    }
    this.state.currentTurn = nextPlayerId;

    console.log("Turn switched to:", nextPlayerId);
  }
}
