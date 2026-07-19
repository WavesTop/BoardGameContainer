import { WebSocket, type RawData } from "ws";

interface Message {
  type: string;
  payload?: {
    roomCode?: string;
    members?: Array<{ userId: string; ready: boolean; isBot?: boolean }>;
    rulesConfig?: {
      rulesetId?: string;
      startingChips?: number;
      smallBlind?: number;
    };
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
      payload: {
        displayName: "Alice",
        gameId: "texas-holdem",
        rulesConfig: {
          rulesetId: "texas-holdem.friend.v1",
          playerCount: 4,
          startingChips: 2000,
          smallBlind: 20,
          turnSeconds: 30,
        },
      },
    }),
  );
  const created = await createdPromise;
  const roomCode = created.payload?.roomCode;
  if (!roomCode) throw new Error("room.created did not include a room code");
  if (
    created.payload?.rulesConfig?.startingChips !== 2000 ||
    created.payload.rulesConfig.smallBlind !== 20
  ) {
    throw new Error("room.created did not preserve the selected room rules");
  }

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

  const botAddedPromise = waitForMessage(
    alice,
    (message) =>
      message.type === "room.bot.added" &&
      message.payload?.members?.some(
        (member) => member.isBot === true && member.ready === true,
      ) === true,
  );
  alice.send(
    JSON.stringify({
      protocolVersion: 1,
      type: "room.bot.add",
      requestId: "smoke-bot-add-0001",
    }),
  );
  const withBot = await botAddedPromise;
  const botUserId = withBot.payload?.members?.find(
    (member) => member.isBot,
  )?.userId;
  if (!botUserId) throw new Error("room.bot.added did not include a bot");

  const botRemovedPromise = waitForMessage(
    alice,
    (message) =>
      message.type === "room.bot.removed" &&
      message.payload?.members?.some((member) => member.isBot) === false,
  );
  alice.send(
    JSON.stringify({
      protocolVersion: 1,
      type: "room.bot.remove",
      requestId: "smoke-bot-remove-0001",
      payload: { botUserId },
    }),
  );
  await botRemovedPromise;

  const bobLeftPromise = waitForMessage(
    bob,
    (message) => message.type === "room.left",
  );
  const aliceAlonePromise = waitForMessage(
    alice,
    (message) =>
      message.type === "room.state" && message.payload?.members?.length === 1,
  );
  bob.send(
    JSON.stringify({
      protocolVersion: 1,
      type: "room.leave",
      requestId: "smoke-leave-0001",
    }),
  );
  await Promise.all([bobLeftPromise, aliceAlonePromise]);

  alice.close();
  bob.close();
  console.log(`WebSocket room flow passed for room ${roomCode}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
