import { describe, expect, it } from "vitest";

import {
  canBeat,
  classifyPlay,
  createPlaytestDeal,
  createPlaytestDeck,
  doudizhuHandPower,
  findSuggestedPlay,
  shouldCallLandlord,
  type PlaytestCard,
} from "../assets/scripts/features/playtest/DoudizhuPlaytestModel";

const deck = createPlaytestDeck();

function cards(...ranks: number[]): PlaytestCard[] {
  const used = new Set<string>();
  return ranks.map((rank) => {
    const card = deck.find(
      (candidate) => candidate.rank === rank && !used.has(candidate.id),
    );
    if (!card) throw new Error(`missing card for rank ${rank}`);
    used.add(card.id);
    return card;
  });
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe("DoudizhuPlaytestModel", () => {
  it("deals a complete deck and gives the landlord the bottom cards", () => {
    const deal = createPlaytestDeal(() => 0.42);
    expect(deal.hands.map((hand) => hand.length)).toEqual([20, 17, 17]);
    expect(deal.bottomCards).toHaveLength(3);
    const ids = deal.hands.flat().map((card) => card.id);
    expect(new Set(ids).size).toBe(54);
  });

  it("recognizes the supported quick-play combinations", () => {
    expect(classifyPlay(cards(3))?.type).toBe("single");
    expect(classifyPlay(cards(4, 4))?.type).toBe("pair");
    expect(classifyPlay(cards(5, 5, 5, 8))?.type).toBe("tripleSingle");
    expect(classifyPlay(cards(3, 4, 5, 6, 7))?.type).toBe("straight");
    expect(classifyPlay(cards(9, 9, 10, 10, 11, 11))?.type).toBe(
      "pairStraight",
    );
    expect(classifyPlay(cards(16, 17))?.type).toBe("rocket");
    expect(classifyPlay(cards(3, 3, 4))).toBeNull();
  });

  it("applies bomb and rocket priority correctly", () => {
    const pair = classifyPlay(cards(8, 8));
    const bomb = classifyPlay(cards(3, 3, 3, 3));
    const rocket = classifyPlay(cards(16, 17));
    if (!pair || !bomb || !rocket) throw new Error("test combo missing");
    expect(canBeat(bomb, pair)).toBe(true);
    expect(canBeat(rocket, bomb)).toBe(true);
    expect(canBeat(pair, bomb)).toBe(false);
  });

  it("suggests a legal higher pair before spending a bomb", () => {
    const previous = classifyPlay(cards(7, 7));
    if (!previous) throw new Error("test combo missing");
    const suggestion = findSuggestedPlay(cards(4, 4, 9, 9, 12), previous);
    expect(suggestion?.map((card) => card.rank)).toEqual([9, 9]);
  });

  it("passes after a rocket because no legal play can beat it", () => {
    const rocket = classifyPlay(cards(16, 17));
    if (!rocket) throw new Error("test combo missing");
    expect(findSuggestedPlay(cards(16, 17), rocket)).toBeNull();
  });

  it("leads a long combination instead of mechanically playing one card", () => {
    const suggestion = findSuggestedPlay(cards(3, 4, 5, 6, 7, 9, 9));
    expect(classifyPlay(suggestion ?? [])?.type).toBe("straight");
    expect(suggestion).toHaveLength(5);
  });

  it("cooperates with a farmer teammate and conserves bombs", () => {
    const pair = classifyPlay(cards(7, 7));
    const highPair = classifyPlay(cards(10, 10));
    if (!pair || !highPair) throw new Error("test combo missing");
    expect(
      findSuggestedPlay(cards(9, 9, 12), pair, {
        playerIndex: 2,
        previousPlayerIndex: 1,
        handCounts: [6, 4, 3],
      }),
    ).toBeNull();
    expect(
      findSuggestedPlay(cards(3, 3, 3, 3, 4, 5, 6, 8), highPair),
    ).toBeNull();
  });

  it("uses hand strength and forced fallback for landlord bidding", () => {
    const strong = cards(16, 17, 15, 15, 15, 15, 14, 14);
    const weak = cards(3, 4, 5, 6, 7, 8, 9, 10);
    expect(doudizhuHandPower(strong)).toBeGreaterThan(doudizhuHandPower(weak));
    expect(shouldCallLandlord(strong, true)).toBe(true);
    expect(shouldCallLandlord(weak, false)).toBe(false);
    expect(shouldCallLandlord(weak, false, true)).toBe(true);
  });

  it("can autoplay many dealt games to a winner without an invalid move", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const hands = createPlaytestDeal(seededRandom(seed)).hands;
      let currentPlayer = 0;
      let lastPlay:
        | {
            playerIndex: number;
            combo: NonNullable<ReturnType<typeof classifyPlay>>;
          }
        | undefined;
      let passCount = 0;
      let winner: number | undefined;

      for (let step = 0; step < 500 && winner === undefined; step += 1) {
        const previous =
          lastPlay && lastPlay.playerIndex !== currentPlayer
            ? lastPlay.combo
            : undefined;
        const suggestion = findSuggestedPlay(hands[currentPlayer], previous);
        if (!suggestion) {
          passCount += 1;
          if (passCount >= 2) {
            passCount = 0;
            lastPlay = undefined;
          }
        } else {
          const combo = classifyPlay(suggestion);
          expect(
            combo,
            `seed ${seed} produced an invalid suggestion`,
          ).not.toBeNull();
          if (!combo) throw new Error("suggestion must have a valid combo");
          if (previous) expect(canBeat(combo, previous)).toBe(true);
          const ids = new Set(suggestion.map((card) => card.id));
          hands[currentPlayer] = hands[currentPlayer].filter(
            (card) => !ids.has(card.id),
          );
          passCount = 0;
          lastPlay = { playerIndex: currentPlayer, combo };
          if (hands[currentPlayer].length === 0) winner = currentPlayer;
        }
        currentPlayer = (currentPlayer + 1) % 3;
      }

      expect(winner, `seed ${seed} did not finish`).not.toBeUndefined();
    }
  });
});
