export type ConnectionState =
  "idle" | "connecting" | "open" | "closed" | "error";

export interface NetworkPort {
  readonly state: ConnectionState;
  connect(url: string): Promise<void>;
  send(message: unknown): void;
  close(code?: number, reason?: string): void;
  onMessage(listener: (message: unknown) => void): () => void;
  onStateChange(listener: (state: ConnectionState) => void): () => void;
}
