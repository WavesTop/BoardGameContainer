import { RuleViolation, type GameModule, type Viewer } from "@bgc/game-sdk";

export interface DemoState {
  currentPlayerIndex: number;
  playerIds: readonly string[];
  total: number;
  finished: boolean;
}

export type DemoCommand = { type: "ADD_ONE" };

export type DemoEvent =
  | { type: "MATCH_CREATED"; playerIds: readonly string[] }
  | { type: "ONE_ADDED"; actorId: string }
  | { type: "MATCH_FINISHED"; winnerId: string };

export interface DemoView {
  currentPlayerId: string | null;
  total: number;
  finished: boolean;
}

export const initialDemoState: DemoState = {
  currentPlayerIndex: 0,
  playerIds: [],
  total: 0,
  finished: false,
};

export const demoGame: GameModule<DemoState, DemoCommand, DemoEvent, DemoView> =
  {
    manifest: {
      gameId: "demo",
      displayName: "确定性计数演示",
      rulesetVersion: "1.0.0",
      engineApiVersion: "1",
      minPlayers: 2,
      maxPlayers: 4,
    },

    createInitialEvents(context) {
      return [{ type: "MATCH_CREATED", playerIds: context.playerIds }];
    },

    decide(state, command, context) {
      if (state.finished)
        throw new RuleViolation("MATCH_FINISHED", "Match is already finished");
      if (command.type !== "ADD_ONE")
        throw new RuleViolation("UNKNOWN_COMMAND", "Unknown command");
      if (state.playerIds[state.currentPlayerIndex] !== context.actorId) {
        throw new RuleViolation("NOT_YOUR_TURN", "It is not the actor's turn");
      }

      const events: DemoEvent[] = [
        { type: "ONE_ADDED", actorId: context.actorId },
      ];
      if (state.total + 1 >= 5)
        events.push({ type: "MATCH_FINISHED", winnerId: context.actorId });
      return events;
    },

    evolve(state, event) {
      switch (event.type) {
        case "MATCH_CREATED":
          return { ...initialDemoState, playerIds: [...event.playerIds] };
        case "ONE_ADDED":
          return {
            ...state,
            total: state.total + 1,
            currentPlayerIndex:
              (state.currentPlayerIndex + 1) % state.playerIds.length,
          };
        case "MATCH_FINISHED":
          return { ...state, finished: true };
      }
    },

    project(state, _viewer: Viewer) {
      return {
        currentPlayerId: state.playerIds[state.currentPlayerIndex] ?? null,
        total: state.total,
        finished: state.finished,
      };
    },

    legalActions(state, viewer) {
      const enabled =
        viewer.kind === "player" &&
        viewer.userId === state.playerIds[state.currentPlayerIndex];
      return enabled
        ? [{ type: "ADD_ONE", enabled: true }]
        : [{ type: "ADD_ONE", enabled: false, reason: "NOT_YOUR_TURN" }];
    },

    result(state) {
      return state.finished ? { finished: true, winners: [] } : null;
    },

    assertInvariants(state) {
      if (state.total < 0 || state.total > 5)
        throw new Error("total must stay between 0 and 5");
      if (
        state.playerIds.length > 0 &&
        state.currentPlayerIndex >= state.playerIds.length
      ) {
        throw new Error("currentPlayerIndex out of range");
      }
    },
  };
