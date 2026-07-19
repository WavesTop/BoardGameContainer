import { describe, expect, it } from "vitest";

import {
  availableSelfActions,
  chooseMahjongDiscard,
  chooseMahjongResponse,
  createGuizhouMahjongState,
  createMahjongWall,
  discardMahjongTile,
  isWinningMahjongHand,
  mahjongActionPlacements,
  mahjongDiscardPlacements,
  mahjongPlacementBounds,
  performMahjongSelfAction,
  respondToMahjongDiscard,
} from "../assets/scripts/features/playtest/GuizhouMahjongPlaytestModel";

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function hand(...kinds: number[]) {
  const wall = createMahjongWall();
  const used = new Set<string>();
  return kinds.map((kind) => {
    const tile = wall.find(
      (candidate) => candidate.kind === kind && !used.has(candidate.id),
    );
    if (!tile) throw new Error(`tile kind ${kind} is missing`);
    used.add(tile.id);
    return tile;
  });
}

describe("GuizhouMahjongPlaytestModel", () => {
  it("uses the 108-tile three-suit Guizhou base wall", () => {
    const wall = createMahjongWall();
    expect(wall).toHaveLength(108);
    expect(new Set(wall.map((tile) => tile.kind))).toHaveLength(27);
  });

  it("recognizes standard and seven-pairs winning hands", () => {
    expect(
      isWinningMahjongHand(hand(0, 1, 2, 3, 4, 5, 9, 9, 9, 18, 19, 20, 26, 26)),
    ).toBe(true);
    expect(
      isWinningMahjongHand(
        hand(0, 0, 2, 2, 4, 4, 9, 9, 13, 13, 18, 18, 26, 26),
      ),
    ).toBe(true);
    expect(
      isWinningMahjongHand(
        hand(0, 1, 3, 4, 5, 7, 9, 11, 13, 15, 18, 20, 22, 26),
      ),
    ).toBe(false);
  });

  it("prefers discarding an isolated tile over breaking a pair or run", () => {
    const tiles = hand(0, 1, 2, 4, 4, 9, 10, 11, 18, 19, 20, 22, 22, 26);
    expect(chooseMahjongDiscard(tiles).kind).toBe(26);
  });

  it("keeps the latest draw separate until the player confirms a discard", () => {
    const state = createGuizhouMahjongState(undefined, seededRandom(7));
    const player = state.players[0];
    const drawnTileId = state.drawnTileId;
    expect(player?.hand[player.hand.length - 1]?.id).toBe(drawnTileId);

    const discard = player?.hand.find((tile) => tile.id !== drawnTileId);
    expect(discard).toBeDefined();
    discardMahjongTile(state, 0, discard?.id ?? "");

    const kinds = player?.hand.map((tile) => tile.kind) ?? [];
    expect(kinds).toEqual([...kinds].sort((left, right) => left - right));
    expect(state.drawnTileId).not.toBe(drawnTileId);
  });

  it("fits a four-player all-pass draw without overlapping discard tiles", () => {
    const state = createGuizhouMahjongState(undefined, seededRandom(19));
    for (let step = 0; state.phase !== "finished" && step < 500; step += 1) {
      if (state.phase === "response") {
        const pending =
          state.response?.options.filter(
            (option) =>
              !state.response?.decisions.some(
                (decision) => decision.playerIndex === option.playerIndex,
              ),
          ) ?? [];
        for (const option of pending) {
          respondToMahjongDiscard(state, option.playerIndex, "pass");
        }
        continue;
      }
      const actor = state.currentPlayerIndex;
      const tile = chooseMahjongDiscard(state.players[actor]?.hand ?? []);
      discardMahjongTile(state, actor, tile.id);
    }

    expect(state.phase).toBe("finished");
    expect(state.winners).toEqual([]);
    expect(state.wall).toHaveLength(0);
    const placements = state.players.flatMap((player, playerIndex) => {
      expect(player.discards.length).toBeLessThanOrEqual(18);
      return mahjongDiscardPlacements(playerIndex, player.discards.length);
    });
    for (let leftIndex = 0; leftIndex < placements.length; leftIndex += 1) {
      const left = mahjongPlacementBounds(placements[leftIndex]!);
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < placements.length;
        rightIndex += 1
      ) {
        const right = mahjongPlacementBounds(placements[rightIndex]!);
        const overlaps =
          left.left < right.right &&
          left.right > right.left &&
          left.top < right.bottom &&
          left.bottom > right.top;
        expect(overlaps, `placements ${leftIndex} and ${rightIndex}`).toBe(
          false,
        );
      }
    }
  });

  it("packs only the available response actions into one right-aligned group", () => {
    const gangOnly = mahjongActionPlacements(["gang", "pass"]);
    const pengAndGang = mahjongActionPlacements(["peng", "gang", "pass"]);

    expect(gangOnly.map((placement) => placement.action)).toEqual([
      "gang",
      "pass",
    ]);
    expect(pengAndGang.map((placement) => placement.action)).toEqual([
      "peng",
      "gang",
      "pass",
    ]);
    expect(gangOnly[1]!.x + gangOnly[1]!.width).toBe(1516);
    expect(pengAndGang[2]!.x + pengAndGang[2]!.width).toBe(1516);
    for (const placements of [gangOnly, pengAndGang]) {
      for (let index = 1; index < placements.length; index += 1) {
        expect(placements[index]!.x - placements[index - 1]!.x).toBe(104);
      }
    }
  });

  it("lets four bots draw, discard, pass, peng, gang and hu to completion", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const state = createGuizhouMahjongState(undefined, seededRandom(seed));
      for (let step = 0; state.phase !== "finished" && step < 500; step += 1) {
        if (state.phase === "response") {
          const pending =
            state.response?.options.filter(
              (option) =>
                !state.response?.decisions.some(
                  (decision) => decision.playerIndex === option.playerIndex,
                ),
            ) ?? [];
          for (const option of pending) {
            respondToMahjongDiscard(
              state,
              option.playerIndex,
              chooseMahjongResponse(state, option.playerIndex),
            );
          }
          continue;
        }
        const actor = state.currentPlayerIndex;
        const self = availableSelfActions(state, actor);
        if (self.canHu) {
          performMahjongSelfAction(state, actor, "hu");
        } else if (self.gangKinds.length > 0 && state.wall.length > 8) {
          performMahjongSelfAction(state, actor, "gang", self.gangKinds[0]);
        } else {
          const tile = chooseMahjongDiscard(state.players[actor]?.hand ?? []);
          discardMahjongTile(state, actor, tile.id);
        }
      }
      expect(state.phase, `seed ${seed} did not finish`).toBe("finished");
      const representedTiles =
        state.wall.length +
        state.players.reduce(
          (sum, player) =>
            sum +
            player.hand.length +
            player.discards.length +
            player.melds.reduce(
              (meldSum, meld) => meldSum + (meld.type === "gang" ? 4 : 3),
              0,
            ),
          0,
        );
      expect(representedTiles).toBe(108);
    }
  });
});
