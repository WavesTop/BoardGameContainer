import { describe, expect, it } from "vitest";

import {
  createDefaultRoomRules,
  orderRoomPlayerNames,
  resolveRoomRules,
  roomRuleSummary,
} from "../assets/scripts/features/lobby/FriendRoomRules";

describe("friend room rules", () => {
  it.each([
    ["texas-holdem", "texas-holdem.friend.v1", 4],
    ["doudizhu", "doudizhu.friend.v1", 3],
    ["guizhou-mahjong", "guizhou-mahjong.friend.v1", 4],
  ] as const)("provides defaults for %s", (gameId, rulesetId, playerCount) => {
    expect(createDefaultRoomRules(gameId)).toMatchObject({
      rulesetId,
      playerCount,
    });
  });

  it("summarizes customized rules for the waiting room", () => {
    expect(
      roomRuleSummary({
        rulesetId: "texas-holdem.friend.v1",
        playerCount: 2,
        startingChips: 2000,
        smallBlind: 20,
        turnSeconds: 60,
      }),
    ).toBe("2 人 · 2000 筹码  ·  盲注 20/40 · 60 秒操作");
  });

  it("falls back to game defaults for rooms created by an older server", () => {
    expect(resolveRoomRules("texas-holdem", undefined)).toMatchObject({
      rulesetId: "texas-holdem.friend.v1",
      playerCount: 4,
      startingChips: 1000,
    });
    expect(resolveRoomRules("guizhou-mahjong", undefined)).toMatchObject({
      rulesetId: "guizhou-mahjong.friend.v1",
      playerCount: 4,
      roundCount: 4,
    });
  });

  it("puts the local room member in the human seat", () => {
    const members = [
      {
        userId: "bot-1",
        displayName: "阿策",
        ready: true,
        connected: true,
        isBot: true,
      },
      {
        userId: "self",
        displayName: "桌游玩家",
        ready: true,
        connected: true,
        isBot: false,
      },
    ];

    expect(orderRoomPlayerNames(members, "self")).toEqual(["桌游玩家", "阿策"]);
  });
});
