import { describe, expect, it } from "vitest";

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
});
