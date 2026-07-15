import { _decorator, Component, director } from "cc";

const { ccclass, property } = _decorator;

@ccclass("BootController")
export class BootController extends Component {
  @property({ tooltip: "The scene loaded after runtime checks complete." })
  public lobbyScene = "Lobby";

  protected override start(): void {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    // TODO: Load remote runtime config, check minimum client/assets versions,
    // initialize the WeChat platform adapter, then preload the lobby bundle.
    await Promise.resolve();
    if (director.getScene()?.name === this.lobbyScene) return;
    console.info(`[BootController] ready; next scene: ${this.lobbyScene}`);
  }
}
