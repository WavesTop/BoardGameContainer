import { describe, expect, it } from "vitest";

import {
  DEFAULT_DOUDIZHU_ROOM_RULES,
  DEFAULT_TEXAS_HOLDEM_ROOM_RULES,
} from "@bgc/protocol";

import { DomainError, RoomService } from "../src/domain/room-service.js";

describe("RoomService", () => {
  it("creates, joins, and readies a room", () => {
    const rooms = new RoomService();
    const created = rooms.createRoom("alice", "Alice", "demo");
    expect(created.roomCode).toMatch(/^\d{6}$/);

    const joined = rooms.joinRoom(created.roomCode, "bob", "Bob");
    expect(joined.members).toHaveLength(2);

    const ready = rooms.setReady(created.roomCode, "bob", true);
    expect(ready.members.find((member) => member.userId === "bob")?.ready).toBe(
      true,
    );
  });

  it("rejects missing rooms", () => {
    const rooms = new RoomService();
    expect(() => rooms.joinRoom("000000", "alice", "Alice")).toThrow(
      DomainError,
    );
  });

  it("transfers the host and removes an empty room when players leave", () => {
    const rooms = new RoomService();
    const created = rooms.createRoom("alice", "Alice", "demo");
    rooms.joinRoom(created.roomCode, "bob", "Bob");

    const remaining = rooms.leaveRoom(created.roomCode, "alice");
    expect(remaining?.hostUserId).toBe("bob");
    expect(remaining?.members.map((member) => member.userId)).toEqual(["bob"]);

    expect(rooms.leaveRoom(created.roomCode, "bob")).toBeNull();
    expect(() => rooms.getRoom(created.roomCode)).toThrow(DomainError);
  });

  it("enforces the three-player capacity for doudizhu", () => {
    const rooms = new RoomService();
    const created = rooms.createRoom("alice", "Alice", "doudizhu");
    rooms.joinRoom(created.roomCode, "bob", "Bob");
    rooms.joinRoom(created.roomCode, "carol", "Carol");

    expect(() => rooms.joinRoom(created.roomCode, "dave", "Dave")).toThrowError(
      /full/i,
    );
  });

  it("persists selected rules and uses the configured Texas seat count", () => {
    const rooms = new RoomService();
    const created = rooms.createRoom("alice", "Alice", "texas-holdem", {
      ...DEFAULT_TEXAS_HOLDEM_ROOM_RULES,
      playerCount: 2,
      startingChips: 2000,
      smallBlind: 20,
    });

    expect(created.rulesConfig).toMatchObject({
      playerCount: 2,
      startingChips: 2000,
      smallBlind: 20,
    });
    rooms.joinRoom(created.roomCode, "bob", "Bob");
    expect(() =>
      rooms.joinRoom(created.roomCode, "carol", "Carol"),
    ).toThrowError(/full/i);
  });

  it("fills an eight-player Texas room without exceeding its capacity", () => {
    const rooms = new RoomService();
    const created = rooms.createRoom("alice", "Alice", "texas-holdem", {
      ...DEFAULT_TEXAS_HOLDEM_ROOM_RULES,
      playerCount: 8,
    });
    let room = created;
    for (let index = 0; index < 7; index += 1) {
      room = rooms.addBot(created.roomCode, "alice");
    }

    expect(room.members).toHaveLength(8);
    expect(new Set(room.members.map((member) => member.displayName)).size).toBe(
      8,
    );
    expect(() => rooms.addBot(created.roomCode, "alice")).toThrowError(/full/i);
  });

  it("rejects rules that do not belong to the selected game", () => {
    const rooms = new RoomService();
    expect(() =>
      rooms.createRoom(
        "alice",
        "Alice",
        "texas-holdem",
        DEFAULT_DOUDIZHU_ROOM_RULES,
      ),
    ).toThrowError(/rules/i);
  });

  it("lets only the host fill and clear empty seats with ready bots", () => {
    const rooms = new RoomService();
    const created = rooms.createRoom("alice", "Alice", "guizhou-mahjong");
    rooms.joinRoom(created.roomCode, "bob", "Bob");

    expect(() => rooms.addBot(created.roomCode, "bob")).toThrowError(/host/i);
    const withBot = rooms.addBot(created.roomCode, "alice");
    const bot = withBot.members.find((member) => member.isBot);
    expect(bot).toMatchObject({ ready: true, connected: true });
    if (!bot) throw new Error("bot should exist");

    const removed = rooms.removeBot(created.roomCode, "alice", bot.userId);
    expect(removed.members.some((member) => member.isBot)).toBe(false);
  });

  it("counts bots toward the game-specific room capacity", () => {
    const rooms = new RoomService();
    const created = rooms.createRoom("alice", "Alice", "doudizhu");
    rooms.addBot(created.roomCode, "alice");
    rooms.addBot(created.roomCode, "alice");
    expect(() => rooms.addBot(created.roomCode, "alice")).toThrowError(/full/i);
  });

  it("closes a room instead of transferring host ownership to a bot", () => {
    const rooms = new RoomService();
    const created = rooms.createRoom("alice", "Alice", "texas-holdem");
    rooms.addBot(created.roomCode, "alice");

    expect(rooms.leaveRoom(created.roomCode, "alice")).toBeNull();
    expect(() => rooms.getRoom(created.roomCode)).toThrow(DomainError);
  });
});
