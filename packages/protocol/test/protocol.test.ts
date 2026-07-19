import { describe, expect, it } from "vitest";

import {
  DEFAULT_DOUDIZHU_ROOM_RULES,
  DEFAULT_TEXAS_HOLDEM_ROOM_RULES,
  parseClientMessage,
  PROTOCOL_VERSION,
} from "../src/index.js";

describe("client protocol", () => {
  it("accepts a valid room create command", () => {
    const result = parseClientMessage({
      protocolVersion: PROTOCOL_VERSION,
      type: "room.create",
      requestId: "request-0001",
      payload: { displayName: "Alice", gameId: "demo" },
    });

    expect(result.type).toBe("room.create");
    if (result.type === "room.create") {
      expect(result.payload.rulesConfig).toMatchObject({
        rulesetId: "demo.friend.v1",
        playerCount: 4,
      });
    }
  });

  it("accepts game-specific friend-room rules", () => {
    const result = parseClientMessage({
      protocolVersion: PROTOCOL_VERSION,
      type: "room.create",
      requestId: "request-0003",
      payload: {
        displayName: "Alice",
        gameId: "doudizhu",
        rulesConfig: {
          ...DEFAULT_DOUDIZHU_ROOM_RULES,
          roundCount: 8,
          multiplierCap: 128,
        },
      },
    });

    expect(result.type).toBe("room.create");
    if (result.type === "room.create") {
      expect(result.payload.rulesConfig).toMatchObject({
        roundCount: 8,
        multiplierCap: 128,
      });
    }
  });

  it("accepts eight Texas players and rejects a ninth seat", () => {
    const message = {
      protocolVersion: PROTOCOL_VERSION,
      type: "room.create",
      requestId: "request-texas-eight",
      payload: {
        displayName: "Alice",
        gameId: "texas-holdem",
        rulesConfig: {
          ...DEFAULT_TEXAS_HOLDEM_ROOM_RULES,
          playerCount: 8,
        },
      },
    } as const;

    expect(parseClientMessage(message).type).toBe("room.create");
    expect(() =>
      parseClientMessage({
        ...message,
        requestId: "request-texas-nine",
        payload: {
          ...message.payload,
          rulesConfig: { ...message.payload.rulesConfig, playerCount: 9 },
        },
      }),
    ).toThrow();
  });

  it("rejects room rules belonging to another game", () => {
    expect(() =>
      parseClientMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "room.create",
        requestId: "request-0004",
        payload: {
          displayName: "Alice",
          gameId: "texas-holdem",
          rulesConfig: DEFAULT_DOUDIZHU_ROOM_RULES,
        },
      }),
    ).toThrow();
  });

  it("rejects invalid room codes", () => {
    expect(() =>
      parseClientMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "room.join",
        requestId: "request-0002",
        payload: { displayName: "Bob", roomCode: "ABC" },
      }),
    ).toThrow();
  });

  it("accepts room lifecycle commands", () => {
    expect(
      parseClientMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "room.ready",
        requestId: "request-ready-0001",
        payload: { ready: true },
      }).type,
    ).toBe("room.ready");
    expect(
      parseClientMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "room.leave",
        requestId: "request-leave-0001",
      }).type,
    ).toBe("room.leave");
    expect(
      parseClientMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "room.bot.add",
        requestId: "request-bot-add-0001",
      }).type,
    ).toBe("room.bot.add");
    expect(
      parseClientMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "room.bot.remove",
        requestId: "request-bot-remove-0001",
        payload: { botUserId: "bot:test:1" },
      }).type,
    ).toBe("room.bot.remove");
  });
});
