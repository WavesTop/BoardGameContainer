import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

const requestIdSchema = z.string().min(8).max(128);
const userIdSchema = z.string().min(1).max(128);
const displayNameSchema = z.string().trim().min(1).max(24);
const roomCodeSchema = z.string().regex(/^\d{6}$/);

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
    payload: z.object({
      displayName: displayNameSchema,
      gameId: z.string().min(1).max(64).default("demo"),
    }),
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
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface RoomMemberView {
  userId: string;
  displayName: string;
  ready: boolean;
  connected: boolean;
}

export interface RoomView {
  roomId: string;
  roomCode: string;
  hostUserId: string;
  gameId: string;
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
      type: "room.created" | "room.joined";
      requestId: string;
      payload: RoomView;
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
