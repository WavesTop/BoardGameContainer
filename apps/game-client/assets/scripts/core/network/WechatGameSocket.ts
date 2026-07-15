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
 * Uses wx.connectSocket inside the Mini Game runtime and the standard
 * WebSocket implementation in Creator preview or Web builds.
 */
export class WechatGameSocket implements NetworkPort {
  private wechatSocket?: SocketTaskLike;
  private browserSocket?: BrowserSocketLike;
  private readonly messageListeners = new Set<(message: unknown) => void>();
  private readonly stateListeners = new Set<(state: ConnectionState) => void>();
  private currentState: ConnectionState = "idle";

  get state(): ConnectionState {
    return this.currentState;
  }

  connect(url: string): Promise<void> {
    const globals = globalThis as typeof globalThis & {
      wx?: WechatGameApi;
      WebSocket?: BrowserSocketConstructor;
    };
    this.transition("connecting");
    if (globals.wx) return this.connectWechat(globals.wx, url);
    if (globals.WebSocket) return this.connectBrowser(globals.WebSocket, url);
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
    this.wechatSocket?.close({ code, reason });
    this.browserSocket?.close(code, reason);
    this.wechatSocket = undefined;
    this.browserSocket = undefined;
  }

  onMessage(listener: (message: unknown) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private connectWechat(api: WechatGameApi, url: string): Promise<void> {
    const socket = api.connectSocket({ url, timeout: 10_000 });
    this.wechatSocket = socket;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      socket.onOpen(() => {
        settled = true;
        this.transition("open");
        resolve();
      });
      socket.onMessage((event) => this.handleRawMessage(event.data));
      socket.onClose(() => this.transition("closed"));
      socket.onError(() => {
        this.transition("error");
        if (!settled) reject(new Error("Failed to open WeChat WebSocket"));
      });
    });
  }

  private connectBrowser(
    Socket: BrowserSocketConstructor,
    url: string,
  ): Promise<void> {
    const socket = new Socket(url);
    this.browserSocket = socket;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      socket.onopen = () => {
        settled = true;
        this.transition("open");
        resolve();
      };
      socket.onmessage = (event) => this.handleRawMessage(event.data);
      socket.onclose = () => this.transition("closed");
      socket.onerror = () => {
        this.transition("error");
        if (!settled) reject(new Error("Failed to open browser WebSocket"));
      };
    });
  }

  private handleRawMessage(data: string | ArrayBuffer): void {
    if (typeof data !== "string") return;
    try {
      const message: unknown = JSON.parse(data);
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
