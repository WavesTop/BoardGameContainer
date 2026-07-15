import { describe, expect, it } from "vitest";

import { demoGame, initialDemoState } from "../src/index.js";

describe("demo game", () => {
  it("advances deterministically", () => {
    let state = initialDemoState;
    for (const event of demoGame.createInitialEvents({
      matchId: "match-1",
      playerIds: ["alice", "bob"],
      createdAt: "2026-07-15T00:00:00.000Z",
    })) {
      state = demoGame.evolve(state, event);
    }

    const events = demoGame.decide(
      state,
      { type: "ADD_ONE" },
      {
        actorId: "alice",
        commandId: "command-1",
        serverTime: "2026-07-15T00:00:01.000Z",
      },
    );
    for (const event of events) state = demoGame.evolve(state, event);

    expect(state.total).toBe(1);
    expect(
      demoGame.project(state, { kind: "player", userId: "bob" })
        .currentPlayerId,
    ).toBe("bob");
    expect(() => demoGame.assertInvariants(state)).not.toThrow();
  });
});
