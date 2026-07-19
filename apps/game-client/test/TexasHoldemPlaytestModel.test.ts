import { describe, expect, it } from "vitest";

import {
  actTexas,
  chooseTexasAiAction,
  compareHandRanks,
  createPokerDeck,
  createTexasState,
  evaluateBestHand,
  texasRaiseBounds,
} from "../assets/scripts/features/playtest/TexasHoldemPlaytestModel";

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function cards(...descriptions: readonly [number, string][]) {
  const deck = createPokerDeck();
  return descriptions.map(([rank, suit]) => {
    const card = deck.find(
      (candidate) => candidate.rank === rank && candidate.suit === suit,
    );
    if (!card) throw new Error("test card is missing");
    return card;
  });
}

describe("TexasHoldemPlaytestModel", () => {
  it("creates a complete deck and posts both blinds", () => {
    expect(createPokerDeck()).toHaveLength(52);
    const state = createTexasState(undefined, seededRandom(1));
    expect(state.players.every((player) => player.holeCards.length === 2)).toBe(
      true,
    );
    expect(state.pot).toBe(30);
    expect(state.currentBet).toBe(20);
  });

  it("starts an eight-player table with the selected chips and blinds", () => {
    const names = [
      "我",
      "阿策",
      "小满",
      "老周",
      "七喜",
      "南风",
      "石榴",
      "北辰",
    ];
    const state = createTexasState(names, seededRandom(8), {
      startingChips: 2_000,
      smallBlind: 20,
    });

    expect(state.players).toHaveLength(8);
    expect(state.players.every((player) => player.holeCards.length === 2)).toBe(
      true,
    );
    expect(state.startingChips).toBe(2_000);
    expect(state.pot).toBe(60);
    expect(state.currentBet).toBe(40);
    expect(() =>
      createTexasState([...names, "第九位"], seededRandom(9)),
    ).toThrow("2 to 8 players");
  });

  it("ranks a straight flush above quads and handles the wheel", () => {
    const straightFlush = evaluateBestHand(
      cards(
        [14, "spade"],
        [2, "spade"],
        [3, "spade"],
        [4, "spade"],
        [5, "spade"],
      ),
    );
    const quads = evaluateBestHand(
      cards(
        [9, "spade"],
        [9, "heart"],
        [9, "club"],
        [9, "diamond"],
        [14, "spade"],
      ),
    );
    expect(straightFlush.label).toBe("同花顺");
    expect(straightFlush.kickers[0]).toBe(5);
    expect(compareHandRanks(straightFlush, quads)).toBeGreaterThan(0);
  });

  it("accepts a player-entered raise total within the current bounds", () => {
    const state = createTexasState(undefined, seededRandom(2));
    state.currentPlayerIndex = 0;
    expect(texasRaiseBounds(state, 0)).toEqual({
      minimum: 40,
      maximum: 1_000,
    });

    actTexas(state, 0, { type: "raise", raiseTo: 275 });

    expect(state.currentBet).toBe(275);
    expect(state.players[0]?.streetBet).toBe(275);
    expect(state.players[0]?.stack).toBe(725);
  });

  it("rejects a player-entered raise total below the minimum", () => {
    const state = createTexasState(undefined, seededRandom(3));
    state.currentPlayerIndex = 0;

    expect(() => actTexas(state, 0, { type: "raise", raiseTo: 30 })).toThrow(
      "Raise does not meet the minimum size",
    );
  });

  it("rejects a player-entered raise total above the available stack", () => {
    const state = createTexasState(undefined, seededRandom(4));
    state.currentPlayerIndex = 0;

    expect(() => actTexas(state, 0, { type: "raise", raiseTo: 1_001 })).toThrow(
      "Raise exceeds the player's stack",
    );
    expect(state.players[0]?.stack).toBe(1_000);
    expect(state.players[0]?.streetBet).toBe(0);
  });

  it("lets strategic bots finish many hands without losing chips", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const random = seededRandom(seed);
      const state = createTexasState(undefined, random);
      for (let step = 0; state.phase !== "finished" && step < 300; step += 1) {
        const actor = state.currentPlayerIndex;
        actTexas(state, actor, chooseTexasAiAction(state, actor, random));
      }
      expect(state.phase, `seed ${seed} did not finish`).toBe("finished");
      expect(state.players.reduce((sum, player) => sum + player.stack, 0)).toBe(
        4_000,
      );
      expect(state.winners.length).toBeGreaterThan(0);
    }
  });
});
