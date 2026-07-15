import { _decorator, Component, HorizontalTextAlignment, Node } from "cc";

import {
  gameCategories,
  getCategory,
  getGame,
  type GameAvailability,
  type GameCategoryId,
} from "../../catalog/GameCatalog";
import type { ConnectionState } from "../../core/network/NetworkPort";
import type { RoomView } from "../../core/network/RealtimeClient";
import { theme } from "../../core/theme/Theme";
import { button, chip, clearChildren, panel, text } from "../../ui/UiKit";

const { ccclass } = _decorator;

interface LobbyActions {
  createRoom(gameId: string): Promise<RoomView>;
  joinRoom(roomCode: string): Promise<RoomView>;
}

type ModalState =
  | { kind: "none" }
  | { kind: "create"; gameId: string }
  | { kind: "join" }
  | { kind: "room"; title: string; room: RoomView };

const availabilityText: Record<GameAvailability, string> = {
  available: "可以创建",
  planned: "规划中",
  research: "规则研究",
};

@ccclass("LobbyView")
export class LobbyView extends Component {
  private categoryId: GameCategoryId = "cards";
  private connectionState: ConnectionState = "idle";
  private displayName = "桌游玩家";
  private roomCode = "";
  private modal: ModalState = { kind: "none" };
  private toastMessage = "";
  private toastTimer?: ReturnType<typeof setTimeout>;
  private busy = false;
  private actions: LobbyActions = {
    createRoom: () => Promise.reject(new Error("大厅尚未连接服务")),
    joinRoom: () => Promise.reject(new Error("大厅尚未连接服务")),
  };

  configure(displayName: string, actions: LobbyActions): void {
    this.displayName = displayName;
    this.actions = actions;
  }

  setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    if (this.node.activeInHierarchy) this.render();
  }

  notify(message: string): void {
    this.showToast(message);
  }

  protected override start(): void {
    this.render();
  }

  protected override onDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private render(): void {
    clearChildren(this.node);
    this.renderBackground();
    this.renderTopBar();
    this.renderHero();
    this.renderCatalog();
    this.renderFooter();
    this.renderModal();
    this.renderToast();
  }

  private renderBackground(): void {
    panel(this.node, "Background", {
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
      color: theme.color.background,
    });
    panel(this.node, "Glow", {
      x: 1120,
      y: -180,
      width: 620,
      height: 620,
      radius: 310,
      color: theme.color.surfaceRaised,
      alpha: 70,
    });
  }

  private renderTopBar(): void {
    panel(this.node, "TopBar", {
      x: 0,
      y: 0,
      width: 1600,
      height: 88,
      color: theme.color.surface,
    });
    panel(this.node, "Avatar", {
      x: 44,
      y: 20,
      width: 48,
      height: 48,
      radius: 24,
      color: theme.color.primaryStrong,
    });
    text(this.node, "PlayerName", {
      x: 112,
      y: 17,
      width: 360,
      height: 34,
      text: `晚上好，${this.displayName}`,
      fontSize: 24,
      bold: true,
    });
    text(this.node, "PlayerHint", {
      x: 112,
      y: 49,
      width: 420,
      height: 24,
      text: "好友桌游大厅 · 首发微信小游戏",
      fontSize: 14,
      color: theme.color.textMuted,
    });

    const connection = connectionPresentation(this.connectionState);
    panel(this.node, "ConnectionDot", {
      x: 1314,
      y: 36,
      width: 14,
      height: 14,
      radius: 7,
      color: connection.color,
    });
    text(this.node, "ConnectionText", {
      x: 1338,
      y: 23,
      width: 174,
      height: 40,
      text: connection.text,
      fontSize: 16,
      color: theme.color.textMuted,
    });
  }

  private renderHero(): void {
    panel(this.node, "Hero", {
      x: 52,
      y: 120,
      width: 1496,
      height: 208,
      radius: 24,
      color: "#0F3835",
      stroke: theme.color.outline,
    });
    text(this.node, "HeroEyebrow", {
      x: 92,
      y: 148,
      width: 500,
      height: 30,
      text: "今晚想玩什么？",
      fontSize: 18,
      color: theme.color.primary,
    });
    text(this.node, "HeroTitle", {
      x: 92,
      y: 176,
      width: 660,
      height: 60,
      text: "选一个品类，开一桌好友局",
      fontSize: 38,
      bold: true,
    });
    text(this.node, "HeroBody", {
      x: 92,
      y: 240,
      width: 700,
      height: 42,
      text: "纸牌、麻将和聚会推理共用同一套房间、重连与结算底座。",
      fontSize: 18,
      color: theme.color.textMuted,
    });
    button(
      this.node,
      "CreateRoom",
      "创建好友房",
      {
        x: 1050,
        y: 172,
        width: 210,
        height: 64,
        radius: 17,
        color: theme.color.primary,
      },
      () => this.openCreate("doudizhu"),
    );
    button(
      this.node,
      "JoinRoom",
      "输入房间码",
      {
        x: 1280,
        y: 172,
        width: 220,
        height: 64,
        radius: 17,
        color: theme.color.surfaceRaised,
        textColor: theme.color.text,
      },
      () => {
        this.roomCode = "";
        this.modal = { kind: "join" };
        this.render();
      },
    );
    text(this.node, "HeroStatus", {
      x: 1050,
      y: 247,
      width: 450,
      height: 32,
      text:
        this.connectionState === "open"
          ? "服务已连接，可以创建和加入房间"
          : "本地服务未连接时仍可浏览游戏目录",
      fontSize: 14,
      color:
        this.connectionState === "open"
          ? theme.color.accent
          : theme.color.textMuted,
    });
  }

  private renderCatalog(): void {
    text(this.node, "CatalogTitle", {
      x: 60,
      y: 364,
      width: 300,
      height: 42,
      text: "游戏分类",
      fontSize: 26,
      bold: true,
    });
    text(this.node, "CatalogHint", {
      x: 250,
      y: 370,
      width: 620,
      height: 30,
      text: "先选玩法品类，再选择具体地区规则或游戏模式",
      fontSize: 15,
      color: theme.color.textMuted,
    });

    gameCategories.forEach((category, index) => {
      const active = category.id === this.categoryId;
      button(
        this.node,
        `Category-${category.id}`,
        `${category.glyph}  ${category.name}`,
        {
          x: 60 + index * 196,
          y: 416,
          width: 178,
          height: 52,
          radius: 16,
          color: active ? theme.color.primary : theme.color.surfaceRaised,
          textColor: active ? theme.color.background : theme.color.text,
        },
        () => {
          this.categoryId = category.id;
          this.render();
        },
      );
    });

    const category = getCategory(this.categoryId);
    text(this.node, "CategorySummary", {
      x: 670,
      y: 419,
      width: 860,
      height: 46,
      text: category.summary,
      fontSize: 16,
      color: theme.color.textMuted,
      align: HorizontalTextAlignment.RIGHT,
    });

    category.games.forEach((game, index) => {
      const x = 60 + index * 500;
      panel(this.node, `GameCard-${game.id}`, {
        x,
        y: 500,
        width: 470,
        height: 264,
        radius: 22,
        color: theme.color.surface,
        stroke: theme.color.outline,
      });
      panel(this.node, `GameAccent-${game.id}`, {
        x,
        y: 500,
        width: 12,
        height: 264,
        radius: 6,
        color: game.accent,
      });
      panel(this.node, `GameGlyph-${game.id}`, {
        x: x + 30,
        y: 528,
        width: 74,
        height: 74,
        radius: 20,
        color: game.accent,
      });
      text(this.node, `GameGlyphText-${game.id}`, {
        x: x + 30,
        y: 528,
        width: 74,
        height: 74,
        text: category.glyph,
        fontSize: 32,
        bold: true,
        align: HorizontalTextAlignment.CENTER,
      });
      text(this.node, `GameName-${game.id}`, {
        x: x + 126,
        y: 526,
        width: 310,
        height: 42,
        text: game.name,
        fontSize: 26,
        bold: true,
      });
      text(this.node, `GameSubtitle-${game.id}`, {
        x: x + 126,
        y: 568,
        width: 310,
        height: 28,
        text: game.subtitle,
        fontSize: 15,
        color: theme.color.textMuted,
      });
      chip(
        this.node,
        `GameStatus-${game.id}`,
        availabilityText[game.availability],
        x + 30,
        624,
        100,
        game.availability === "available"
          ? "#245E52"
          : theme.color.surfaceRaised,
        game.availability === "available"
          ? theme.color.accent
          : theme.color.textMuted,
      );
      text(this.node, `GameMeta-${game.id}`, {
        x: x + 146,
        y: 621,
        width: 280,
        height: 34,
        text: `${game.players}  ·  ${game.duration}`,
        fontSize: 15,
        color: theme.color.textMuted,
      });
      button(
        this.node,
        `GameAction-${game.id}`,
        game.availability === "available" ? "选择玩法" : "查看规划",
        {
          x: x + 30,
          y: 684,
          width: 410,
          height: 52,
          radius: 15,
          color:
            game.availability === "available"
              ? theme.color.primary
              : theme.color.surfaceRaised,
          textColor:
            game.availability === "available"
              ? theme.color.background
              : theme.color.textMuted,
        },
        () => {
          if (game.availability === "available") this.openCreate(game.id);
          else
            this.showToast(
              `${game.name}仍在${availabilityText[game.availability]}阶段`,
            );
        },
      );
    });
  }

  private renderFooter(): void {
    text(this.node, "Footer", {
      x: 60,
      y: 828,
      width: 1480,
      height: 36,
      text: "好友私密房 · 不含真钱与可兑换筹码 · 规则由服务端权威判定",
      fontSize: 14,
      color: theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });
  }

  private renderModal(): void {
    if (this.modal.kind === "none") return;
    panel(this.node, "ModalOverlay", {
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
      color: "#021010",
      alpha: 224,
    });
    if (this.modal.kind === "create") this.renderCreateModal(this.modal.gameId);
    if (this.modal.kind === "join") this.renderJoinModal();
    if (this.modal.kind === "room")
      this.renderRoomModal(this.modal.title, this.modal.room);
  }

  private renderCreateModal(gameId: string): void {
    const game = getGame(gameId);
    if (!game) return;
    panel(this.node, "CreateModal", {
      x: 450,
      y: 238,
      width: 700,
      height: 424,
      radius: 24,
      color: theme.color.surface,
      stroke: theme.color.outline,
      strokeWidth: 2,
    });
    text(this.node, "CreateTitle", {
      x: 494,
      y: 274,
      width: 610,
      height: 48,
      text: `创建${game.name}好友房`,
      fontSize: 30,
      bold: true,
    });
    text(this.node, "CreateDescription", {
      x: 494,
      y: 332,
      width: 610,
      height: 48,
      text: `${game.players} · ${game.duration} · 房间规则开局后锁定`,
      fontSize: 17,
      color: theme.color.textMuted,
    });
    panel(this.node, "RuleSummary", {
      x: 494,
      y: 402,
      width: 610,
      height: 112,
      radius: 18,
      color: theme.color.surfaceRaised,
    });
    text(this.node, "RuleSummaryText", {
      x: 522,
      y: 420,
      width: 552,
      height: 76,
      text: "经典好友局\n30 秒操作 · 允许托管 · 倍数上限 64",
      fontSize: 18,
      lineHeight: 34,
      color: theme.color.text,
    });
    button(
      this.node,
      "CreateCancel",
      "取消",
      {
        x: 494,
        y: 560,
        width: 196,
        height: 58,
        radius: 16,
        color: theme.color.surfaceRaised,
        textColor: theme.color.text,
      },
      () => {
        this.modal = { kind: "none" };
        this.render();
      },
    );
    button(
      this.node,
      "CreateConfirm",
      this.busy ? "创建中…" : "确认创建",
      {
        x: 710,
        y: 560,
        width: 396,
        height: 58,
        radius: 16,
        enabled: !this.busy && this.connectionState === "open",
      },
      () => void this.createRoom(game.id),
    );
  }

  private renderJoinModal(): void {
    panel(this.node, "JoinModal", {
      x: 470,
      y: 120,
      width: 660,
      height: 660,
      radius: 24,
      color: theme.color.surface,
      stroke: theme.color.outline,
      strokeWidth: 2,
    });
    text(this.node, "JoinTitle", {
      x: 514,
      y: 154,
      width: 572,
      height: 46,
      text: "加入好友房",
      fontSize: 30,
      bold: true,
      align: HorizontalTextAlignment.CENTER,
    });
    panel(this.node, "RoomCodeDisplay", {
      x: 550,
      y: 224,
      width: 500,
      height: 82,
      radius: 18,
      color: theme.color.surfaceRaised,
      stroke:
        this.roomCode.length === 6 ? theme.color.accent : theme.color.outline,
    });
    text(this.node, "RoomCodeText", {
      x: 550,
      y: 224,
      width: 500,
      height: 82,
      text: formatRoomCodeEntry(this.roomCode),
      fontSize: 34,
      bold: true,
      color:
        this.roomCode.length === 6
          ? theme.color.primary
          : theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });

    const keys = [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "清空",
      "0",
      "删除",
    ];
    keys.forEach((key, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      button(
        this.node,
        `Key-${key}`,
        key,
        {
          x: 570 + column * 158,
          y: 340 + row * 72,
          width: 140,
          height: 56,
          radius: 15,
          color: theme.color.surfaceRaised,
          textColor: theme.color.text,
        },
        () => {
          if (key === "清空") this.roomCode = "";
          else if (key === "删除") this.roomCode = this.roomCode.slice(0, -1);
          else if (this.roomCode.length < 6) this.roomCode += key;
          this.render();
        },
      );
    });

    button(
      this.node,
      "JoinCancel",
      "取消",
      {
        x: 514,
        y: 656,
        width: 190,
        height: 58,
        radius: 16,
        color: theme.color.surfaceRaised,
        textColor: theme.color.text,
      },
      () => {
        this.modal = { kind: "none" };
        this.render();
      },
    );
    button(
      this.node,
      "JoinConfirm",
      this.busy ? "加入中…" : "加入房间",
      {
        x: 726,
        y: 656,
        width: 360,
        height: 58,
        radius: 16,
        enabled:
          this.roomCode.length === 6 &&
          !this.busy &&
          this.connectionState === "open",
      },
      () => void this.joinRoom(),
    );
  }

  private renderRoomModal(title: string, room: RoomView): void {
    panel(this.node, "RoomModal", {
      x: 460,
      y: 230,
      width: 680,
      height: 440,
      radius: 24,
      color: theme.color.surface,
      stroke: theme.color.primaryStrong,
      strokeWidth: 2,
    });
    text(this.node, "RoomTitle", {
      x: 504,
      y: 270,
      width: 592,
      height: 48,
      text: title,
      fontSize: 30,
      bold: true,
      align: HorizontalTextAlignment.CENTER,
    });
    text(this.node, "RoomCodeLabel", {
      x: 504,
      y: 342,
      width: 592,
      height: 30,
      text: "房间码",
      fontSize: 16,
      color: theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });
    text(this.node, "RoomCode", {
      x: 504,
      y: 374,
      width: 592,
      height: 68,
      text: `${room.roomCode.slice(0, 3)}  ${room.roomCode.slice(3)}`,
      fontSize: 44,
      bold: true,
      color: theme.color.primary,
      align: HorizontalTextAlignment.CENTER,
    });
    text(this.node, "RoomMeta", {
      x: 504,
      y: 466,
      width: 592,
      height: 52,
      text: `${getGame(room.gameId)?.name ?? room.gameId} · ${room.members.length} 位玩家 · revision ${room.revision}`,
      fontSize: 17,
      color: theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });
    button(
      this.node,
      "RoomDone",
      "进入候场房（下一迭代）",
      {
        x: 530,
        y: 556,
        width: 540,
        height: 62,
        radius: 17,
      },
      () => this.showToast("房间服务已打通，候场房场景将在下一步实现"),
    );
  }

  private renderToast(): void {
    if (!this.toastMessage) return;
    panel(this.node, "Toast", {
      x: 520,
      y: 796,
      width: 560,
      height: 58,
      radius: 18,
      color: "#1C504B",
      stroke: theme.color.accent,
    });
    text(this.node, "ToastText", {
      x: 540,
      y: 796,
      width: 520,
      height: 58,
      text: this.toastMessage,
      fontSize: 17,
      align: HorizontalTextAlignment.CENTER,
    });
  }

  private openCreate(gameId: string): void {
    this.modal = { kind: "create", gameId };
    this.render();
  }

  private async createRoom(gameId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      const room = await this.actions.createRoom(gameId);
      this.modal = { kind: "room", title: "好友房创建成功", room };
    } catch (error) {
      this.modal = { kind: "none" };
      this.showToast(error instanceof Error ? error.message : "创建房间失败");
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async joinRoom(): Promise<void> {
    if (this.busy || this.roomCode.length !== 6) return;
    this.busy = true;
    this.render();
    try {
      const room = await this.actions.joinRoom(this.roomCode);
      this.modal = { kind: "room", title: "已加入好友房", room };
    } catch (error) {
      this.modal = { kind: "join" };
      this.showToast(error instanceof Error ? error.message : "加入房间失败");
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage = "";
      if (this.node.isValid) this.render();
    }, 3_000);
    this.render();
  }
}

function connectionPresentation(state: ConnectionState): {
  text: string;
  color: string;
} {
  switch (state) {
    case "open":
      return { text: "服务在线", color: theme.color.accent };
    case "connecting":
      return { text: "正在连接", color: theme.color.primary };
    case "error":
      return { text: "连接失败", color: theme.color.danger };
    case "closed":
      return { text: "连接已断开", color: theme.color.danger };
    default:
      return { text: "本地浏览", color: theme.color.textMuted };
  }
}

function formatRoomCodeEntry(roomCode: string): string {
  const characters = roomCode.split("");
  while (characters.length < 6) characters.push("·");
  return characters.join("  ");
}
