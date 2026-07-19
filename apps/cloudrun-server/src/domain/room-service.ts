import { randomInt, randomUUID } from "node:crypto";

import {
  defaultRoomRules,
  type RoomMemberView,
  type RoomRulesConfig,
  type RoomView,
  type SupportedGameId,
} from "@bgc/protocol";

interface RoomMember extends RoomMemberView {}

interface RoomState {
  roomId: string;
  roomCode: string;
  hostUserId: string;
  gameId: SupportedGameId;
  rulesConfig: RoomRulesConfig;
  revision: number;
  createdAt: string;
  members: Map<string, RoomMember>;
  nextBotNumber: number;
}

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class RoomService {
  private readonly roomsByCode = new Map<string, RoomState>();

  createRoom(
    userId: string,
    displayName: string,
    gameId: SupportedGameId,
    rulesConfig: RoomRulesConfig = defaultRoomRules(gameId),
  ): RoomView {
    requireRulesForGame(gameId, rulesConfig);
    const roomCode = this.nextRoomCode();
    const room: RoomState = {
      roomId: randomUUID(),
      roomCode,
      hostUserId: userId,
      gameId,
      rulesConfig: { ...rulesConfig },
      revision: 1,
      createdAt: new Date().toISOString(),
      members: new Map([
        [
          userId,
          {
            userId,
            displayName,
            ready: false,
            connected: true,
            isBot: false,
          },
        ],
      ]),
      nextBotNumber: 1,
    };
    this.roomsByCode.set(roomCode, room);
    return this.toView(room);
  }

  joinRoom(roomCode: string, userId: string, displayName: string): RoomView {
    const room = this.requireRoom(roomCode);
    const existing = room.members.get(userId);
    if (existing) {
      existing.connected = true;
      existing.displayName = displayName;
    } else {
      if (room.members.size >= room.rulesConfig.playerCount) {
        throw new DomainError("ROOM_FULL", "Room is already full");
      }
      room.members.set(userId, {
        userId,
        displayName,
        ready: false,
        connected: true,
        isBot: false,
      });
    }
    room.revision += 1;
    return this.toView(room);
  }

  leaveRoom(roomCode: string, userId: string): RoomView | null {
    const room = this.requireRoom(roomCode);
    if (!room.members.delete(userId)) {
      throw new DomainError("NOT_IN_ROOM", "User is not in this room");
    }
    if (room.members.size === 0) {
      this.roomsByCode.delete(roomCode);
      return null;
    }
    if (room.hostUserId === userId) {
      const nextHost = [...room.members.values()].find(
        (member) => !member.isBot,
      )?.userId;
      if (!nextHost) {
        this.roomsByCode.delete(roomCode);
        return null;
      }
      room.hostUserId = nextHost;
    }
    room.revision += 1;
    return this.toView(room);
  }

  setReady(roomCode: string, userId: string, ready: boolean): RoomView {
    const room = this.requireRoom(roomCode);
    const member = room.members.get(userId);
    if (!member)
      throw new DomainError("NOT_IN_ROOM", "User is not in this room");
    member.ready = ready;
    room.revision += 1;
    return this.toView(room);
  }

  addBot(roomCode: string, actorId: string): RoomView {
    const room = this.requireRoom(roomCode);
    this.requireHost(room, actorId);
    if (room.members.size >= room.rulesConfig.playerCount) {
      throw new DomainError("ROOM_FULL", "Room is already full");
    }
    const botNumber = room.nextBotNumber;
    room.nextBotNumber += 1;
    const botUserId = `bot:${room.roomId}:${botNumber}`;
    room.members.set(botUserId, {
      userId: botUserId,
      displayName:
        BOT_NAMES[(botNumber - 1) % BOT_NAMES.length] ?? "牌友机器人",
      ready: true,
      connected: true,
      isBot: true,
    });
    room.revision += 1;
    return this.toView(room);
  }

  removeBot(roomCode: string, actorId: string, botUserId: string): RoomView {
    const room = this.requireRoom(roomCode);
    this.requireHost(room, actorId);
    const member = room.members.get(botUserId);
    if (!member?.isBot) {
      throw new DomainError("BOT_NOT_FOUND", "Bot is not in this room");
    }
    room.members.delete(botUserId);
    room.revision += 1;
    return this.toView(room);
  }

  setConnected(
    roomCode: string,
    userId: string,
    connected: boolean,
  ): RoomView | null {
    const room = this.roomsByCode.get(roomCode);
    const member = room?.members.get(userId);
    if (!room || !member) return null;
    member.connected = connected;
    room.revision += 1;
    return this.toView(room);
  }

  getRoom(roomCode: string): RoomView {
    return this.toView(this.requireRoom(roomCode));
  }

  private requireRoom(roomCode: string): RoomState {
    const room = this.roomsByCode.get(roomCode);
    if (!room)
      throw new DomainError(
        "ROOM_NOT_FOUND",
        "Room does not exist or has expired",
      );
    return room;
  }

  private nextRoomCode(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const roomCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
      if (!this.roomsByCode.has(roomCode)) return roomCode;
    }
    throw new DomainError(
      "ROOM_CODE_EXHAUSTED",
      "Could not allocate a room code",
      true,
    );
  }

  private requireHost(room: RoomState, actorId: string): void {
    if (room.hostUserId !== actorId) {
      throw new DomainError("HOST_ONLY", "Only the room host can manage bots");
    }
  }

  private toView(room: RoomState): RoomView {
    return {
      roomId: room.roomId,
      roomCode: room.roomCode,
      hostUserId: room.hostUserId,
      gameId: room.gameId,
      rulesConfig: { ...room.rulesConfig },
      revision: room.revision,
      createdAt: room.createdAt,
      members: [...room.members.values()].map((member) => ({ ...member })),
    };
  }
}

function requireRulesForGame(
  gameId: SupportedGameId,
  rulesConfig: RoomRulesConfig,
): void {
  const expectedRuleset: Record<SupportedGameId, RoomRulesConfig["rulesetId"]> =
    {
      demo: "demo.friend.v1",
      "texas-holdem": "texas-holdem.friend.v1",
      doudizhu: "doudizhu.friend.v1",
      "guizhou-mahjong": "guizhou-mahjong.friend.v1",
    };
  if (rulesConfig.rulesetId !== expectedRuleset[gameId]) {
    throw new DomainError(
      "INVALID_ROOM_RULES",
      "Room rules do not match the selected game",
    );
  }
}

const BOT_NAMES = [
  "阿策",
  "小满",
  "老周",
  "七喜",
  "南风",
  "石榴",
  "北辰",
] as const;
