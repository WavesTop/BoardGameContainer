import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

const requestIdSchema = z.string().min(8).max(128);
const userIdSchema = z.string().min(1).max(128);
const displayNameSchema = z.string().trim().min(1).max(24);
const roomCodeSchema = z.string().regex(/^\d{6}$/);

export const texasHoldemRoomRulesSchema = z.object({
  rulesetId: z.literal("texas-holdem.friend.v1"),
  playerCount: z.union([
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
    z.literal(8),
  ]),
  startingChips: z.union([z.literal(500), z.literal(1000), z.literal(2000)]),
  smallBlind: z.union([z.literal(5), z.literal(10), z.literal(20)]),
  turnSeconds: z.union([z.literal(15), z.literal(30), z.literal(60)]),
});

export const doudizhuRoomRulesSchema = z.object({
  rulesetId: z.literal("doudizhu.friend.v1"),
  playerCount: z.literal(3),
  roundCount: z.union([z.literal(1), z.literal(4), z.literal(8)]),
  multiplierCap: z.union([z.literal(32), z.literal(64), z.literal(128)]),
  turnSeconds: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  allowAutoPlay: z.boolean(),
});

export const guizhouMahjongRoomRulesSchema = z.object({
  rulesetId: z.literal("guizhou-mahjong.friend.v1"),
  playerCount: z.literal(4),
  roundCount: z.union([z.literal(1), z.literal(4), z.literal(8)]),
  turnSeconds: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  allowSevenPairs: z.boolean(),
  allowMultipleWinners: z.boolean(),
});

const demoRoomRulesSchema = z.object({
  rulesetId: z.literal("demo.friend.v1"),
  playerCount: z.literal(4),
});

export const roomRulesConfigSchema = z.discriminatedUnion("rulesetId", [
  texasHoldemRoomRulesSchema,
  doudizhuRoomRulesSchema,
  guizhouMahjongRoomRulesSchema,
  demoRoomRulesSchema,
]);

export type TexasHoldemRoomRules = z.infer<typeof texasHoldemRoomRulesSchema>;
export type DoudizhuRoomRules = z.infer<typeof doudizhuRoomRulesSchema>;
export type GuizhouMahjongRoomRules = z.infer<
  typeof guizhouMahjongRoomRulesSchema
>;
export type RoomRulesConfig = z.infer<typeof roomRulesConfigSchema>;
export type SupportedGameId =
  "demo" | "texas-holdem" | "doudizhu" | "guizhou-mahjong";

export const DEFAULT_TEXAS_HOLDEM_ROOM_RULES: TexasHoldemRoomRules = {
  rulesetId: "texas-holdem.friend.v1",
  playerCount: 4,
  startingChips: 1000,
  smallBlind: 10,
  turnSeconds: 30,
};

export const DEFAULT_DOUDIZHU_ROOM_RULES: DoudizhuRoomRules = {
  rulesetId: "doudizhu.friend.v1",
  playerCount: 3,
  roundCount: 4,
  multiplierCap: 64,
  turnSeconds: 30,
  allowAutoPlay: true,
};

export const DEFAULT_GUIZHOU_MAHJONG_ROOM_RULES: GuizhouMahjongRoomRules = {
  rulesetId: "guizhou-mahjong.friend.v1",
  playerCount: 4,
  roundCount: 4,
  turnSeconds: 30,
  allowSevenPairs: true,
  allowMultipleWinners: true,
};

const DEFAULT_DEMO_ROOM_RULES = {
  rulesetId: "demo.friend.v1",
  playerCount: 4,
} as const;

export function defaultRoomRules(gameId: SupportedGameId): RoomRulesConfig {
  switch (gameId) {
    case "texas-holdem":
      return { ...DEFAULT_TEXAS_HOLDEM_ROOM_RULES };
    case "doudizhu":
      return { ...DEFAULT_DOUDIZHU_ROOM_RULES };
    case "guizhou-mahjong":
      return { ...DEFAULT_GUIZHOU_MAHJONG_ROOM_RULES };
    default:
      return { ...DEFAULT_DEMO_ROOM_RULES };
  }
}

const roomCreatePayloadSchema = z.discriminatedUnion("gameId", [
  z.object({
    displayName: displayNameSchema,
    gameId: z.literal("texas-holdem"),
    rulesConfig: texasHoldemRoomRulesSchema.default(
      DEFAULT_TEXAS_HOLDEM_ROOM_RULES,
    ),
  }),
  z.object({
    displayName: displayNameSchema,
    gameId: z.literal("doudizhu"),
    rulesConfig: doudizhuRoomRulesSchema.default(DEFAULT_DOUDIZHU_ROOM_RULES),
  }),
  z.object({
    displayName: displayNameSchema,
    gameId: z.literal("guizhou-mahjong"),
    rulesConfig: guizhouMahjongRoomRulesSchema.default(
      DEFAULT_GUIZHOU_MAHJONG_ROOM_RULES,
    ),
  }),
  z.object({
    displayName: displayNameSchema,
    gameId: z.literal("demo"),
    rulesConfig: demoRoomRulesSchema.default(DEFAULT_DEMO_ROOM_RULES),
  }),
]);

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("system.ping"),
    requestId: requestIdSchema,
  }),
  z.object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("room.create"),
    requestId: requestIdSchema,
    payload: roomCreatePayloadSchema,
  }),
  z.object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("room.join"),
    requestId: requestIdSchema,
    payload: z.object({
      roomCode: roomCodeSchema,
      displayName: displayNameSchema,
    }),
  }),
  z.object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("room.ready"),
    requestId: requestIdSchema,
    payload: z.object({
      ready: z.boolean(),
    }),
  }),
  z.object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("room.bot.add"),
    requestId: requestIdSchema,
  }),
  z.object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("room.bot.remove"),
    requestId: requestIdSchema,
    payload: z.object({
      botUserId: userIdSchema,
    }),
  }),
  z.object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("room.leave"),
    requestId: requestIdSchema,
  }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface RoomMemberView {
  userId: string;
  displayName: string;
  ready: boolean;
  connected: boolean;
  isBot: boolean;
}

export interface RoomView {
  roomId: string;
  roomCode: string;
  hostUserId: string;
  gameId: string;
  rulesConfig: RoomRulesConfig;
  revision: number;
  createdAt: string;
  members: RoomMemberView[];
}

export type ServerMessage =
  | {
      protocolVersion: typeof PROTOCOL_VERSION;
      type: "system.pong";
      requestId: string;
      serverTime: string;
    }
  | {
      protocolVersion: typeof PROTOCOL_VERSION;
      type:
        | "room.created"
        | "room.joined"
        | "room.ready.updated"
        | "room.bot.added"
        | "room.bot.removed";
      requestId: string;
      payload: RoomView;
      selfUserId: string;
    }
  | {
      protocolVersion: typeof PROTOCOL_VERSION;
      type: "room.left";
      requestId: string;
      payload: { roomCode: string };
    }
  | {
      protocolVersion: typeof PROTOCOL_VERSION;
      type: "room.state";
      payload: RoomView;
    }
  | {
      protocolVersion: typeof PROTOCOL_VERSION;
      type: "error";
      requestId?: string;
      error: {
        code: string;
        message: string;
        retryable: boolean;
      };
    };

export function parseClientMessage(input: unknown): ClientMessage {
  return clientMessageSchema.parse(input);
}

export function isUserId(value: string): boolean {
  return userIdSchema.safeParse(value).success;
}
