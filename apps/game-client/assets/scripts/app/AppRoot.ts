import {
  _decorator,
  Canvas,
  Component,
  Node,
  ResolutionPolicy,
  UITransform,
  view,
} from "cc";

import { RealtimeClient } from "../core/network/RealtimeClient";
import { LobbyView } from "../features/lobby/LobbyView";

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
  private stopStateListener?: () => void;

  protected override onLoad(): void {
    view.setDesignResolutionSize(1600, 900, ResolutionPolicy.FIXED_HEIGHT);
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

    this.lobby =
      content.getComponent(LobbyView) ?? content.addComponent(LobbyView);
    this.lobby.configure(this.displayName, {
      createRoom: (gameId) =>
        this.realtime.createRoom(gameId, this.displayName),
      joinRoom: (roomCode) =>
        this.realtime.joinRoom(roomCode, this.displayName),
    });
    this.stopStateListener = this.realtime.onStateChange((state) => {
      this.lobby?.setConnectionState(state);
    });
  }

  protected override start(): void {
    void this.connectRealtime();
  }

  protected override onDestroy(): void {
    this.stopStateListener?.();
    this.realtime.close();
  }

  private async connectRealtime(): Promise<void> {
    try {
      await this.realtime.connect(this.websocketUrl, this.displayName);
      this.lobby?.notify("本地房间服务连接成功");
    } catch (error) {
      console.warn("[AppRoot] realtime connection unavailable", error);
      this.lobby?.notify("未连接本地服务：先运行 pnpm.cmd dev");
    }
  }
}
