import type { ConnectionState, NetworkPort } from "./NetworkPort";

interface SocketTaskLike {
  onOpen(listener: () => void): void;
  onMessage(listener: (event: { data: string | ArrayBuffer }) => void): void;
  onClose(listener: () => void): void;
  onError(listener: () => void): void;
  send(options: { data: string }): void;
  close(options?: { code?: number; reason?: string }): void;
}

interface WechatGameApi {
  connectSocket(options: { url: string; timeout?: number }): SocketTaskLike;
  cloud?: WechatCloudApi;
}

interface WechatCloudApi {
  init(options: { env: string }): void | Promise<void>;
  connectContainer(options: {
    service: string;
    path: string;
  }): Promise<{ socketTask: SocketTaskLike }>;
}

export interface WechatCloudContainerConfig {
  envId: string;
  serviceName: string;
}

interface BrowserSocketLike {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface BrowserSocketConstructor {
  readonly OPEN: number;
  new (url: string): BrowserSocketLike;
}

/**
 * Uses the authenticated CloudBase container channel inside the Mini Game
 * runtime and the standard WebSocket implementation in Creator previews.
 */
export class WechatGameSocket implements NetworkPort {
  private wechatSocket?: SocketTaskLike;
  private browserSocket?: BrowserSocketLike;
  private readonly messageListeners = new Set<(message: unknown) => void>();
  private readonly stateListeners = new Set<(state: ConnectionState) => void>();
  private currentState: ConnectionState = "idle";
  private connectionGeneration = 0;

  constructor(private readonly cloudContainer?: WechatCloudContainerConfig) {}

  get state(): ConnectionState {
    return this.currentState;
  }

  connect(url: string): Promise<void> {
    const globals = globalThis as typeof globalThis & {
      wx?: WechatGameApi;
      WebSocket?: BrowserSocketConstructor;
    };
    this.closeActiveSocket(1000, "reconnect");
    const generation = this.connectionGeneration + 1;
    this.connectionGeneration = generation;
    this.transition("connecting");
    if (globals.wx) {
      if (this.cloudContainer && globals.wx.cloud) {
        return this.connectWechatContainer(
          globals.wx.cloud,
          url,
          generation,
        );
      }
      return this.connectWechat(globals.wx, url, generation);
    }
    if (globals.WebSocket)
      return this.connectBrowser(globals.WebSocket, url, generation);
    this.transition("error");
    return Promise.reject(
      new Error("No WebSocket implementation is available"),
    );
  }

  send(message: unknown): void {
    if (this.currentState !== "open") throw new Error("Socket is not open");
    const data = JSON.stringify(message);
    if (this.wechatSocket) {
      this.wechatSocket.send({ data });
      return;
    }
    if (this.browserSocket) {
      this.browserSocket.send(data);
      return;
    }
    throw new Error("Socket is unavailable");
  }

  close(code = 1000, reason = "client close"): void {
    this.connectionGeneration += 1;
    this.closeActiveSocket(code, reason);
    this.transition("closed");
  }

  onMessage(listener: (message: unknown) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private connectWechat(
    api: WechatGameApi,
    url: string,
    generation: number,
  ): Promise<void> {
    const socket = api.connectSocket({ url, timeout: 10_000 });
    return this.observeWechatSocket(socket, generation);
  }

  private async connectWechatContainer(
    cloud: WechatCloudApi,
    url: string,
    generation: number,
  ): Promise<void> {
    try {
      await cloud.init({ env: this.cloudContainer?.envId ?? "" });
      const { socketTask } = await cloud.connectContainer({
        service: this.cloudContainer?.serviceName ?? "",
        path: websocketPath(url),
      });
      if (!this.isCurrentConnection(generation)) {
        socketTask.close({ code: 1000, reason: "stale connection" });
        return;
      }
      return await this.observeWechatSocket(socketTask, generation);
    } catch (error) {
      if (this.isCurrentConnection(generation)) this.transition("error");
      throw error instanceof Error
        ? error
        : new Error("Failed to connect to CloudBase container");
    }
  }

  private observeWechatSocket(
    socket: SocketTaskLike,
    generation: number,
  ): Promise<void> {
    this.wechatSocket = socket;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      socket.onOpen(() => {
        if (!this.isCurrentConnection(generation)) return;
        settled = true;
        this.transition("open");
        resolve();
      });
      socket.onMessage((event) => {
        if (this.isCurrentConnection(generation))
          this.handleRawMessage(event.data);
      });
      socket.onClose(() => {
        if (!this.isCurrentConnection(generation)) return;
        this.transition("closed");
        if (!settled) {
          settled = true;
          reject(new Error("WeChat WebSocket closed before opening"));
        }
      });
      socket.onError(() => {
        if (!this.isCurrentConnection(generation)) return;
        this.transition("error");
        if (!settled) {
          settled = true;
          reject(new Error("Failed to open WeChat WebSocket"));
        }
      });
    });
  }

  private connectBrowser(
    Socket: BrowserSocketConstructor,
    url: string,
    generation: number,
  ): Promise<void> {
    const socket = new Socket(url);
    this.browserSocket = socket;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      socket.onopen = () => {
        if (!this.isCurrentConnection(generation)) return;
        settled = true;
        this.transition("open");
        resolve();
      };
      socket.onmessage = (event) => {
        if (this.isCurrentConnection(generation))
          this.handleRawMessage(event.data);
      };
      socket.onclose = () => {
        if (!this.isCurrentConnection(generation)) return;
        this.transition("closed");
        if (!settled) {
          settled = true;
          reject(new Error("Browser WebSocket closed before opening"));
        }
      };
      socket.onerror = () => {
        if (!this.isCurrentConnection(generation)) return;
        this.transition("error");
        if (!settled) {
          settled = true;
          reject(new Error("Failed to open browser WebSocket"));
        }
      };
    });
  }

  private isCurrentConnection(generation: number): boolean {
    return generation === this.connectionGeneration;
  }

  private closeActiveSocket(code: number, reason: string): void {
    this.wechatSocket?.close({ code, reason });
    this.browserSocket?.close(code, reason);
    this.wechatSocket = undefined;
    this.browserSocket = undefined;
  }

  private handleRawMessage(data: string | ArrayBuffer): void {
    const text = decodeSocketData(data);
    if (text === undefined) return;
    try {
      const message: unknown = JSON.parse(text);
      for (const listener of this.messageListeners) listener(message);
    } catch {
      console.warn("[WechatGameSocket] ignored a non-JSON message");
    }
  }

  private transition(state: ConnectionState): void {
    this.currentState = state;
    for (const listener of this.stateListeners) listener(state);
  }
}

function websocketPath(url: string): string {
  const schemeIndex = url.indexOf("://");
  const pathIndex = url.indexOf("/", schemeIndex >= 0 ? schemeIndex + 3 : 0);
  if (pathIndex < 0) return "/ws";
  const path = url.slice(pathIndex).split("?", 1)[0];
  return path || "/ws";
}

function decodeSocketData(data: string | ArrayBuffer): string | undefined {
  if (typeof data === "string") return data;
  const bytes = new Uint8Array(data);
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(bytes);
  }
  let encoded = "";
  for (const byte of bytes) encoded += `%${byte.toString(16).padStart(2, "0")}`;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}
