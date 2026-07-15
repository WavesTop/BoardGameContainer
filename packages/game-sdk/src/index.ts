export interface GameManifest {
  gameId: string;
  displayName: string;
  rulesetVersion: string;
  engineApiVersion: string;
  minPlayers: number;
  maxPlayers: number;
}

export interface GameContext {
  matchId: string;
  playerIds: readonly string[];
  createdAt: string;
}

export interface CommandContext {
  actorId: string;
  serverTime: string;
  commandId: string;
}

export interface Viewer {
  kind: "player" | "spectator" | "audit";
  userId?: string;
}

export interface ActionHint {
  type: string;
  enabled: boolean;
  reason?: string;
}

export interface GameResult {
  finished: boolean;
  winners: readonly string[];
  reason?: string;
}

export interface GameModule<State, Command, Event, PlayerView> {
  manifest: GameManifest;
  createInitialEvents(context: GameContext): readonly Event[];
  decide(
    state: State,
    command: Command,
    context: CommandContext,
  ): readonly Event[];
  evolve(state: State, event: Event): State;
  project(state: State, viewer: Viewer): PlayerView;
  legalActions(state: State, viewer: Viewer): readonly ActionHint[];
  result(state: State): GameResult | null;
  assertInvariants(state: State): void;
}

export class RuleViolation extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RuleViolation";
  }
}
