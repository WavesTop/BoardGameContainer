import { sys } from "cc";

import type { ConnectionState, NetworkPort } from "./NetworkPort";
import { WechatGameSocket } from "./WechatGameSocket";

export interface RoomMemberView {
  userId: string;
  displayName: string;
  ready: boolean;
  connected: boolean;
  isBot: boolean;
}

export type FriendRoomGameId = "texas-holdem" | "doudizhu" | "guizhou-mahjong";

export interface TexasHoldemRoomRules {
  rulesetId: "texas-holdem.friend.v1";
  playerCount: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  startingChips: 500 | 1000 | 2000;
  smallBlind: 5 | 10 | 20;
  turnSeconds: 15 | 30 | 60;
}

export interface DoudizhuRoomRules {
  rulesetId: "doudizhu.friend.v1";
  playerCount: 3;
  roundCount: 1 | 4 | 8;
  multiplierCap: 32 | 64 | 128;
  turnSeconds: 15 | 30 | 60;
  allowAutoPlay: boolean;
}

export interface GuizhouMahjongRoomRules {
  rulesetId: "guizhou-mahjong.friend.v1";
  playerCount: 4;
  roundCount: 1 | 4 | 8;
  turnSeconds: 15 | 30 | 60;
  allowSevenPairs: boolean;
  allowMultipleWinners: boolean;
}

export interface DemoRoomRules {
  rulesetId: "demo.friend.v1";
  playerCount: 4;
}

export type RoomRulesConfig =
  | TexasHoldemRoomRules
  | DoudizhuRoomRules
  | GuizhouMahjongRoomRules
  | DemoRoomRules;
export type FriendRoomRulesConfig = Exclude<RoomRulesConfig, DemoRoomRules>;

export interface RoomView {
  roomId: string;
  roomCode: string;
  hostUserId: string;
  gameId: string;
  rulesConfig?: RoomRulesConfig;
  revision: number;
  createdAt: string;
  members: RoomMemberView[];
}

interface ServerMessage {
  type: string;
  requestId?: string;
  payload?: RoomView;
  selfUserId?: string;
  error?: { code: string; message: string; retryable: boolean };
}

interface PendingRequest {
  resolve(message: ServerMessage): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
}

const CLIENT_ID_KEY = "bgc.localClientId";

export class RealtimeClient {
  private readonly pending = new Map<string, PendingRequest>();
  private readonly roomListeners = new Set<(room: RoomView) => void>();
  private readonly socket: NetworkPort;
  private stopMessageListener?: () => void;
  private activeUserId?: string;

  constructor(socket: NetworkPort = new WechatGameSocket()) {
    this.socket = socket;
  }

  get state(): ConnectionState {
    return this.socket.state;
  }

  get currentUserId(): string | undefined {
    return this.activeUserId;
  }

  onStateChange(listener: (state: ConnectionState) => void): () => void {
    return this.socket.onStateChange(listener);
  }

  onRoomChange(listener: (room: RoomView) => void): () => void {
    this.roomListeners.add(listener);
    return () => this.roomListeners.delete(listener);
  }

  async connect(baseUrl: string, displayName: string): Promise<void> {
    this.stopMessageListener?.();
    this.stopMessageListener = this.socket.onMessage((message) =>
      this.handleMessage(message),
    );
    const separator = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${separator}userId=${encodeURIComponent(getLocalClientId())}&displayName=${encodeURIComponent(displayName)}`;
    try {
      await this.socket.connect(url);
      await this.request("system.ping");
    } catch (error) {
      this.socket.close(1011, "handshake failed");
      throw error;
    }
  }

  createRoom(
    gameId: FriendRoomGameId,
    displayName: string,
    rulesConfig: FriendRoomRulesConfig,
  ): Promise<RoomView> {
    return this.requestRoom("room.create", {
      gameId,
      displayName,
      rulesConfig,
    });
  }

  joinRoom(roomCode: string, displayName: string): Promise<RoomView> {
    return this.requestRoom("room.join", { roomCode, displayName });
  }

  setReady(ready: boolean): Promise<RoomView> {
    return this.requestRoom("room.ready", { ready });
  }

  addBot(): Promise<RoomView> {
    return this.requestRoom("room.bot.add");
  }

  removeBot(botUserId: string): Promise<RoomView> {
    return this.requestRoom("room.bot.remove", { botUserId });
  }

  async leaveRoom(): Promise<void> {
    await this.request("room.leave");
    this.activeUserId = undefined;
  }

  close(): void {
    this.stopMessageListener?.();
    this.stopMessageListener = undefined;
    this.socket.close();
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error("Connection closed"));
    }
    this.pending.clear();
  }

  private async requestRoom(
    type: string,
    payload?: unknown,
  ): Promise<RoomView> {
    const message = await this.request(type, payload);
    if (!message.payload)
      throw new Error("Server response did not include room state");
    if (message.selfUserId) this.activeUserId = message.selfUserId;
    return message.payload;
  }

  private request(type: string, payload?: unknown): Promise<ServerMessage> {
    const requestId = createRequestId();
    return new Promise<ServerMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("Server response timed out"));
      }, 8_000);
      this.pending.set(requestId, { resolve, reject, timeout });
      try {
        this.socket.send({
          protocolVersion: 1,
          type,
          requestId,
          ...(payload === undefined ? {} : { payload }),
        });
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(requestId);
        reject(
          error instanceof Error ? error : new Error("Failed to send request"),
        );
      }
    });
  }

  private handleMessage(input: unknown): void {
    if (!isServerMessage(input)) return;
    if (input.type === "room.state" && input.payload) {
      for (const listener of this.roomListeners) listener(input.payload);
    }
    if (!input.requestId) return;
    const pending = this.pending.get(input.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(input.requestId);
    if (input.type === "error") {
      pending.reject(
        new Error(input.error?.message ?? "Server rejected the request"),
      );
    } else {
      pending.resolve(input);
    }
  }
}

function isServerMessage(input: unknown): input is ServerMessage {
  return (
    typeof input === "object" &&
    input !== null &&
    typeof (input as ServerMessage).type === "string"
  );
}

function getLocalClientId(): string {
  const existing = sys.localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const generated = `cocos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  sys.localStorage.setItem(CLIENT_ID_KEY, generated);
  return generated;
}

function createRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
