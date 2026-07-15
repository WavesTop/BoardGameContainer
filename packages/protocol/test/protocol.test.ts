import { describe, expect, it } from "vitest";

import { parseClientMessage, PROTOCOL_VERSION } from "../src/index.js";

describe("client protocol", () => {
  it("accepts a valid room create command", () => {
    const result = parseClientMessage({
      protocolVersion: PROTOCOL_VERSION,
      type: "room.create",
      requestId: "request-0001",
      payload: { displayName: "Alice", gameId: "demo" },
    });

    expect(result.type).toBe("room.create");
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
});
