import { createHash } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import {
  parseClientMessage,
  PROTOCOL_VERSION,
  type RoomView,
  type ServerMessage,
} from "@bgc/protocol";
import { WebSocket, WebSocketServer } from "ws";

import type { AppConfig } from "./config.js";
import { DomainError, RoomService } from "./domain/room-service.js";

interface Peer {
  socket: WebSocket;
  userId: string;
  displayName: string;
  roomCode?: string;
}

export interface ServerApplication {
  listen(port?: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

export function createServerApplication(
  config: AppConfig,
  roomService = new RoomService(),
): ServerApplication {
  const roomPeers = new Map<string, Set<Peer>>();

  const server = createServer((request, response) => {
    handleHttpRequest(request, response, config);
  });
  const socketServer = new WebSocketServer({ server, path: "/ws" });

  socketServer.on("connection", (socket, request) => {
    const identity = resolveIdentity(request, config);
    if (!identity) {
      send(
        socket,
        errorMessage("UNAUTHENTICATED", "A trusted identity is required"),
      );
      socket.close(1008, "Unauthenticated");
      return;
    }

    const peer: Peer = {
      socket,
      userId: identity.userId,
      displayName: identity.displayName,
    };

    socket.on("message", (raw) => {
      void handleSocketMessage(peer, raw.toString());
    });
    socket.on("close", () => {
      if (!peer.roomCode) return;
      roomPeers.get(peer.roomCode)?.delete(peer);
      const view = roomService.setConnected(peer.roomCode, peer.userId, false);
      if (view) broadcastRoom(view);
    });

    async function handleSocketMessage(
      currentPeer: Peer,
      raw: string,
    ): Promise<void> {
      let message: ReturnType<typeof parseClientMessage>;
      try {
        message = parseClientMessage(JSON.parse(raw));
      } catch (error) {
        send(
          currentPeer.socket,
          errorMessage(
            "INVALID_MESSAGE",
            error instanceof Error ? error.message : "Invalid message",
          ),
        );
        return;
      }

      try {
        switch (message.type) {
          case "system.ping":
            send(currentPeer.socket, {
              protocolVersion: PROTOCOL_VERSION,
              type: "system.pong",
              requestId: message.requestId,
              serverTime: new Date().toISOString(),
            });
            break;
          case "room.create": {
            const view = roomService.createRoom(
              currentPeer.userId,
              message.payload.displayName,
              message.payload.gameId,
            );
            movePeerToRoom(currentPeer, view.roomCode);
            send(currentPeer.socket, {
              protocolVersion: PROTOCOL_VERSION,
              type: "room.created",
              requestId: message.requestId,
              payload: view,
            });
            broadcastRoom(view);
            break;
          }
          case "room.join": {
            const view = roomService.joinRoom(
              message.payload.roomCode,
              currentPeer.userId,
              message.payload.displayName,
            );
            movePeerToRoom(currentPeer, view.roomCode);
            send(currentPeer.socket, {
              protocolVersion: PROTOCOL_VERSION,
              type: "room.joined",
              requestId: message.requestId,
              payload: view,
            });
            broadcastRoom(view);
            break;
          }
          case "room.ready": {
            if (!currentPeer.roomCode) {
              throw new DomainError(
                "NOT_IN_ROOM",
                "Join a room before changing ready state",
              );
            }
            const view = roomService.setReady(
              currentPeer.roomCode,
              currentPeer.userId,
              message.payload.ready,
            );
            broadcastRoom(view);
            break;
          }
        }
      } catch (error) {
        const domainError =
          error instanceof DomainError
            ? error
            : new DomainError(
                "INTERNAL_ERROR",
                "Unexpected server error",
                true,
              );
        send(
          currentPeer.socket,
          errorMessage(
            domainError.code,
            domainError.message,
            message.requestId,
            domainError.retryable,
          ),
        );
      }
    }
  });

  function movePeerToRoom(peer: Peer, roomCode: string): void {
    if (peer.roomCode) roomPeers.get(peer.roomCode)?.delete(peer);
    peer.roomCode = roomCode;
    const peers = roomPeers.get(roomCode) ?? new Set<Peer>();
    peers.add(peer);
    roomPeers.set(roomCode, peers);
  }

  function broadcastRoom(view: RoomView): void {
    const message: ServerMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "room.state",
      payload: view,
    };
    for (const peer of roomPeers.get(view.roomCode) ?? [])
      send(peer.socket, message);
  }

  return {
    listen(port = config.PORT, host = config.HOST) {
      return new Promise<number>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          const address = server.address();
          resolve(typeof address === "object" && address ? address.port : port);
        });
      });
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        for (const client of socketServer.clients) client.terminate();
        socketServer.close();
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: AppConfig,
): void {
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");

  if (request.method === "GET" && request.url === "/healthz") {
    response.writeHead(200);
    response.end(
      JSON.stringify({ status: "ok", service: "boardgame-runtime" }),
    );
    return;
  }

  if (request.method === "GET" && request.url === "/readyz") {
    const cloudbaseConfigured = Boolean(config.TCB_ENV_ID);
    const ready = config.BGC_REPOSITORY === "memory" || cloudbaseConfigured;
    response.writeHead(ready ? 200 : 503);
    response.end(
      JSON.stringify({
        status: ready ? "ready" : "not-ready",
        repository: config.BGC_REPOSITORY,
        cloudbaseConfigured,
      }),
    );
    return;
  }

  if (request.method === "GET" && request.url === "/api/runtime-config") {
    response.writeHead(200);
    response.end(
      JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        websocketPath: "/ws",
        serviceName: config.TCB_SERVICE_NAME,
      }),
    );
    return;
  }

  response.writeHead(404);
  response.end(
    JSON.stringify({
      error: { code: "NOT_FOUND", message: "Route not found" },
    }),
  );
}

function resolveIdentity(
  request: IncomingMessage,
  config: AppConfig,
): { userId: string; displayName: string } | null {
  const requestUrl = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`,
  );
  if (config.ALLOW_DEV_IDENTITY) {
    const userId = requestUrl.searchParams.get("userId");
    const displayName = requestUrl.searchParams.get("displayName") ?? userId;
    if (userId)
      return { userId: `dev:${userId}`, displayName: displayName ?? userId };
  }

  const trustedOpenId = request.headers["x-wx-openid"];
  if (typeof trustedOpenId !== "string" || trustedOpenId.length === 0)
    return null;
  return {
    userId: `wx:${createHash("sha256").update(trustedOpenId).digest("hex")}`,
    displayName: "WeChat Player",
  };
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify(message));
}

function errorMessage(
  code: string,
  message: string,
  requestId?: string,
  retryable = false,
): ServerMessage {
  const result: ServerMessage = {
    protocolVersion: PROTOCOL_VERSION,
    type: "error",
    error: { code, message, retryable },
  };
  if (requestId) result.requestId = requestId;
  return result;
}
