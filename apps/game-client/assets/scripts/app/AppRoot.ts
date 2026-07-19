import {
  _decorator,
  Canvas,
  Component,
  Node,
  ResolutionPolicy,
  resources,
  Texture2D,
  UITransform,
  view,
} from "cc";

import { RealtimeClient } from "../core/network/RealtimeClient";
import {
  LobbyView,
  type PlaytestLaunchOptions,
} from "../features/lobby/LobbyView";
import { DoudizhuPlaytestView } from "../features/playtest/DoudizhuPlaytestView";
import { GuizhouMahjongPlaytestView } from "../features/playtest/GuizhouMahjongPlaytestView";
import { TexasHoldemPlaytestView } from "../features/playtest/TexasHoldemPlaytestView";

const { ccclass, property } = _decorator;

@ccclass("AppRoot")
export class AppRoot extends Component {
  @property({
    tooltip:
      "Local preview uses ws://127.0.0.1:3000/ws; production must use WSS.",
  })
  public websocketUrl = "ws://127.0.0.1:3000/ws";

  @property({
    tooltip: "Temporary display name before WeChat profile integration.",
  })
  public displayName = "桌游玩家";

  private readonly realtime = new RealtimeClient();
  private lobby?: LobbyView;
  private playtest?: DoudizhuPlaytestView;
  private texasPlaytest?: TexasHoldemPlaytestView;
  private mahjongPlaytest?: GuizhouMahjongPlaytestView;
  private lobbyScreen?: Node;
  private playtestScreen?: Node;
  private texasPlaytestScreen?: Node;
  private mahjongPlaytestScreen?: Node;
  private stopStateListener?: () => void;
  private stopRoomListener?: () => void;
  private connectPromise?: Promise<void>;

  protected override onLoad(): void {
    view.setDesignResolutionSize(1600, 900, ResolutionPolicy.FIXED_HEIGHT);
    resources.loadDir("ui/characters", Texture2D, (error) => {
      if (error) console.warn("[AppRoot] character preload failed", error);
    });
    const canvas = this.node.getComponent(Canvas);
    if (!canvas) {
      console.error(
        "[AppRoot] attach this component to the Canvas node in Boot.scene",
      );
      this.enabled = false;
      return;
    }

    const existing = this.node.getChildByName("AppContent");
    const content = existing ?? new Node("AppContent");
    if (!existing) this.node.addChild(content);
    const transform =
      content.getComponent(UITransform) ?? content.addComponent(UITransform);
    transform.setAnchorPoint(0, 1);
    transform.setContentSize(1600, 900);
    content.setPosition(-800, 450);

    this.lobbyScreen = createScreen(content, "LobbyScreen");
    this.playtestScreen = createScreen(content, "PlaytestScreen");
    this.texasPlaytestScreen = createScreen(content, "TexasPlaytestScreen");
    this.mahjongPlaytestScreen = createScreen(content, "MahjongPlaytestScreen");
    if (this.playtestScreen) this.playtestScreen.active = false;
    this.texasPlaytestScreen.active = false;
    this.mahjongPlaytestScreen.active = false;

    this.lobby =
      this.lobbyScreen.getComponent(LobbyView) ??
      this.lobbyScreen.addComponent(LobbyView);
    this.playtest =
      this.playtestScreen.getComponent(DoudizhuPlaytestView) ??
      this.playtestScreen.addComponent(DoudizhuPlaytestView);
    this.playtest.configure(() => this.showLobby());
    this.texasPlaytest =
      this.texasPlaytestScreen.getComponent(TexasHoldemPlaytestView) ??
      this.texasPlaytestScreen.addComponent(TexasHoldemPlaytestView);
    this.texasPlaytest.configure(() => this.showLobby());
    this.mahjongPlaytest =
      this.mahjongPlaytestScreen.getComponent(GuizhouMahjongPlaytestView) ??
      this.mahjongPlaytestScreen.addComponent(GuizhouMahjongPlaytestView);
    this.mahjongPlaytest.configure(() => this.showLobby());
    this.lobby.configure(this.displayName, {
      ensureConnected: () => this.ensureRealtimeConnected(),
      createRoom: (gameId, rulesConfig) =>
        this.realtime.createRoom(gameId, this.displayName, rulesConfig),
      joinRoom: (roomCode) =>
        this.realtime.joinRoom(roomCode, this.displayName),
      setReady: (ready) => this.realtime.setReady(ready),
      addBot: () => this.realtime.addBot(),
      removeBot: (botUserId) => this.realtime.removeBot(botUserId),
      leaveRoom: () => this.realtime.leaveRoom(),
      currentUserId: () => this.realtime.currentUserId,
      startPlaytest: (gameId, options) => this.showPlaytest(gameId, options),
    });
    this.stopStateListener = this.realtime.onStateChange((state) => {
      this.lobby?.setConnectionState(state);
    });
    this.stopRoomListener = this.realtime.onRoomChange((room) => {
      this.lobby?.updateRoom(room);
    });
    const inviteRoomCode = getInviteRoomCode();
    if (inviteRoomCode) this.lobby.presentInvite(inviteRoomCode);
  }

  protected override start(): void {
    void this.ensureRealtimeConnected()
      .then(() => this.lobby?.notify("好友房服务已连接"))
      .catch((error: unknown) =>
        this.lobby?.notify(
          error instanceof Error ? error.message : "好友房服务连接失败",
        ),
      );
  }

  protected override onDestroy(): void {
    this.stopStateListener?.();
    this.stopRoomListener?.();
    this.realtime.close();
  }

  private ensureRealtimeConnected(): Promise<void> {
    if (this.realtime.state === "open") return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;
    const connection = this.connectRealtime();
    this.connectPromise = connection;
    void connection.then(
      () => {
        if (this.connectPromise === connection) this.connectPromise = undefined;
      },
      () => {
        if (this.connectPromise === connection) this.connectPromise = undefined;
      },
    );
    return connection;
  }

  private async connectRealtime(): Promise<void> {
    try {
      await this.realtime.connect(this.websocketUrl, this.displayName);
    } catch (error) {
      console.warn("[AppRoot] realtime connection unavailable", error);
      throw new Error(connectionFailureMessage(this.websocketUrl));
    }
  }

  private showPlaytest(
    gameId = "doudizhu",
    options?: PlaytestLaunchOptions,
  ): void {
    if (!this.lobbyScreen) return;
    this.lobbyScreen.active = false;
    if (this.playtestScreen) this.playtestScreen.active = gameId === "doudizhu";
    if (this.texasPlaytestScreen)
      this.texasPlaytestScreen.active = gameId === "texas-holdem";
    if (this.mahjongPlaytestScreen)
      this.mahjongPlaytestScreen.active = gameId === "guizhou-mahjong";
    if (gameId === "texas-holdem") {
      const rules =
        options?.rulesConfig?.rulesetId === "texas-holdem.friend.v1"
          ? options.rulesConfig
          : undefined;
      this.texasPlaytest?.startNewMatch({
        ...(options?.playerNames
          ? { playerNames: options.playerNames }
          : rules
            ? { playerCount: rules.playerCount }
            : {}),
        ...(rules
          ? {
              startingChips: rules.startingChips,
              smallBlind: rules.smallBlind,
            }
          : {}),
      });
    } else if (gameId === "guizhou-mahjong")
      this.mahjongPlaytest?.startNewMatch();
    else this.playtest?.startNewMatch();
  }

  private showLobby(): void {
    if (!this.lobbyScreen) return;
    if (this.playtestScreen) this.playtestScreen.active = false;
    if (this.texasPlaytestScreen) this.texasPlaytestScreen.active = false;
    if (this.mahjongPlaytestScreen) this.mahjongPlaytestScreen.active = false;
    this.lobbyScreen.active = true;
    this.lobby?.refresh();
  }
}

function createScreen(parent: Node, name: string): Node {
  const existing = parent.getChildByName(name);
  const screen = existing ?? new Node(name);
  if (!existing) parent.addChild(screen);
  const transform =
    screen.getComponent(UITransform) ?? screen.addComponent(UITransform);
  transform.setAnchorPoint(0, 1);
  transform.setContentSize(1600, 900);
  screen.setPosition(0, 0);
  return screen;
}

function getInviteRoomCode(): string | undefined {
  const globals = globalThis as typeof globalThis & {
    wx?: {
      getLaunchOptionsSync?(): { query?: Record<string, string> };
    };
  };
  const roomCode = globals.wx?.getLaunchOptionsSync?.().query?.roomCode;
  return roomCode && /^\d{6}$/.test(roomCode) ? roomCode : undefined;
}

function connectionFailureMessage(websocketUrl: string): string {
  return /127\.0\.0\.1|localhost/i.test(websocketUrl)
    ? "本地好友房服务未启动，请启动服务后重试"
    : "好友房服务连接失败，请检查网络后重试";
}
