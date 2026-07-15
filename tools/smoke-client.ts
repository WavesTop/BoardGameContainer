import { WebSocket, type RawData } from "ws";

interface Message {
  type: string;
  payload?: {
    roomCode?: string;
    members?: Array<{ userId: string; ready: boolean }>;
  };
}

function connect(userId: string, displayName: string): Promise<WebSocket> {
  const url = new URL("ws://127.0.0.1:3100/ws");
  url.searchParams.set("userId", userId);
  url.searchParams.set("displayName", displayName);
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function waitForMessage(
  socket: WebSocket,
  predicate: (message: Message) => boolean,
): Promise<Message> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for WebSocket message"));
    }, 5_000);

    function onMessage(data: RawData): void {
      const message = JSON.parse(data.toString()) as Message;
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolve(message);
    }

    socket.on("message", onMessage);
  });
}

async function main(): Promise<void> {
  const alice = await connect("alice", "Alice");
  const createdPromise = waitForMessage(
    alice,
    (message) => message.type === "room.created",
  );
  alice.send(
    JSON.stringify({
      protocolVersion: 1,
      type: "room.create",
      requestId: "smoke-create-0001",
      payload: { displayName: "Alice", gameId: "demo" },
    }),
  );
  const created = await createdPromise;
  const roomCode = created.payload?.roomCode;
  if (!roomCode) throw new Error("room.created did not include a room code");

  const bob = await connect("bob", "Bob");
  const joinedPromise = waitForMessage(
    bob,
    (message) => message.type === "room.joined",
  );
  bob.send(
    JSON.stringify({
      protocolVersion: 1,
      type: "room.join",
      requestId: "smoke-join-00001",
      payload: { roomCode, displayName: "Bob" },
    }),
  );
  await joinedPromise;

  const bobReady = (message: Message) =>
    message.type === "room.state" &&
    message.payload?.members?.some(
      (member) => member.userId === "dev:bob" && member.ready === true,
    ) === true;
  const aliceStatePromise = waitForMessage(alice, bobReady);
  const bobStatePromise = waitForMessage(bob, bobReady);
  bob.send(
    JSON.stringify({
      protocolVersion: 1,
      type: "room.ready",
      requestId: "smoke-ready-0001",
      payload: { ready: true },
    }),
  );
  await Promise.all([aliceStatePromise, bobStatePromise]);

  alice.close();
  bob.close();
  console.log(`WebSocket room flow passed for room ${roomCode}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
