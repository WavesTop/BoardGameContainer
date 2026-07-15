import { randomInt, randomUUID } from "node:crypto";

import type { RoomMemberView, RoomView } from "@bgc/protocol";

interface RoomMember extends RoomMemberView {}

interface RoomState {
  roomId: string;
  roomCode: string;
  hostUserId: string;
  gameId: string;
  revision: number;
  createdAt: string;
  members: Map<string, RoomMember>;
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

  createRoom(userId: string, displayName: string, gameId: string): RoomView {
    const roomCode = this.nextRoomCode();
    const room: RoomState = {
      roomId: randomUUID(),
      roomCode,
      hostUserId: userId,
      gameId,
      revision: 1,
      createdAt: new Date().toISOString(),
      members: new Map([
        [userId, { userId, displayName, ready: false, connected: true }],
      ]),
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
      room.members.set(userId, {
        userId,
        displayName,
        ready: false,
        connected: true,
      });
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

  private toView(room: RoomState): RoomView {
    return {
      roomId: room.roomId,
      roomCode: room.roomCode,
      hostUserId: room.hostUserId,
      gameId: room.gameId,
      revision: room.revision,
      createdAt: room.createdAt,
      members: [...room.members.values()].map((member) => ({ ...member })),
    };
  }
}
