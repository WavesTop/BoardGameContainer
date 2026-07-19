import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WechatGameSocket } from "../assets/scripts/core/network/WechatGameSocket";

class FakeBrowserSocket {
  static readonly OPEN = 1;
  static instances: FakeBrowserSocket[] = [];

  readonly readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeBrowserSocket.instances.push(this);
  }

  send(_data: string): void {}
  close(_code?: number, _reason?: string): void {}
}

class FakeWechatSocket {
  openListener?: () => void;
  messageListener?: (event: { data: string | ArrayBuffer }) => void;
  closeListener?: () => void;
  errorListener?: () => void;
  closedWith?: { code?: number; reason?: string };

  onOpen(listener: () => void): void {
    this.openListener = listener;
  }
  onMessage(listener: (event: { data: string | ArrayBuffer }) => void): void {
    this.messageListener = listener;
  }
  onClose(listener: () => void): void {
    this.closeListener = listener;
  }
  onError(listener: () => void): void {
    this.errorListener = listener;
  }
  send(_options: { data: string }): void {}
  close(options?: { code?: number; reason?: string }): void {
    this.closedWith = options;
  }
}

let websocketDescriptor: PropertyDescriptor | undefined;
let wxDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  FakeBrowserSocket.instances = [];
  websocketDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "WebSocket",
  );
  wxDescriptor = Object.getOwnPropertyDescriptor(globalThis, "wx");
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    value: FakeBrowserSocket,
  });
  Reflect.deleteProperty(globalThis, "wx");
});

afterEach(() => {
  restoreGlobal("WebSocket", websocketDescriptor);
  restoreGlobal("wx", wxDescriptor);
});

describe("WechatGameSocket reconnect", () => {
  it("uses the authenticated CloudBase container channel in WeChat", async () => {
    const cloudSocket = new FakeWechatSocket();
    const initCalls: Array<{ env: string }> = [];
    const connectCalls: Array<{ service: string; path: string }> = [];
    Object.defineProperty(globalThis, "wx", {
      configurable: true,
      value: {
        connectSocket: () => {
          throw new Error("public socket should not be used");
        },
        cloud: {
          init: async (options: { env: string }) => {
            initCalls.push(options);
          },
          connectContainer: async (options: {
            service: string;
            path: string;
          }) => {
            connectCalls.push(options);
            return { socketTask: cloudSocket };
          },
        },
      },
    });

    const socket = new WechatGameSocket({
      envId: "test-env",
      serviceName: "runtime-test",
    });
    const attempt = socket.connect(
      "ws://127.0.0.1:3000/ws?userId=local-test",
    );
    await Promise.resolve();
    await Promise.resolve();
    cloudSocket.openListener?.();

    await expect(attempt).resolves.toBeUndefined();
    expect(initCalls).toEqual([{ env: "test-env" }]);
    expect(connectCalls).toEqual([
      { service: "runtime-test", path: "/ws" },
    ]);
    expect(socket.state).toBe("open");
  });

  it("can reconnect after an initial connection error", async () => {
    const socket = new WechatGameSocket();
    const firstAttempt = socket.connect("ws://first.test/ws");
    const firstSocket = FakeBrowserSocket.instances[0];
    expect(firstSocket).toBeDefined();
    firstSocket?.onerror?.();
    await expect(firstAttempt).rejects.toThrow(/failed to open/i);

    const secondAttempt = socket.connect("ws://second.test/ws");
    const secondSocket = FakeBrowserSocket.instances[1];
    expect(secondSocket).toBeDefined();
    secondSocket?.onopen?.();
    await expect(secondAttempt).resolves.toBeUndefined();
    expect(socket.state).toBe("open");

    firstSocket?.onclose?.();
    expect(socket.state).toBe("open");
  });

  it("rejects when the socket closes before opening", async () => {
    const socket = new WechatGameSocket();
    const attempt = socket.connect("ws://closed.test/ws");
    FakeBrowserSocket.instances[0]?.onclose?.();

    await expect(attempt).rejects.toThrow(/closed before opening/i);
    expect(socket.state).toBe("closed");
  });

  it("decodes ArrayBuffer messages from the WeChat runtime", async () => {
    const socket = new WechatGameSocket();
    const messages: unknown[] = [];
    socket.onMessage((message) => messages.push(message));
    const attempt = socket.connect("ws://messages.test/ws");
    const activeSocket = FakeBrowserSocket.instances[0];
    activeSocket?.onopen?.();
    await attempt;

    const bytes = new TextEncoder().encode(
      JSON.stringify({ type: "room.state", payload: { roomCode: "123456" } }),
    );
    activeSocket?.onmessage?.({ data: bytes.buffer });

    expect(messages).toEqual([
      { type: "room.state", payload: { roomCode: "123456" } },
    ]);
  });
});

function restoreGlobal(
  name: "WebSocket" | "wx",
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}
