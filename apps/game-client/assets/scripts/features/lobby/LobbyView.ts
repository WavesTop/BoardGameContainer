import { _decorator, Component, HorizontalTextAlignment, Node } from "cc";

import {
  gameCategories,
  getCategory,
  getGame,
  type GameAvailability,
  type GameCategoryId,
} from "../../catalog/GameCatalog";
import type { ConnectionState } from "../../core/network/NetworkPort";
import type {
  FriendRoomGameId,
  FriendRoomRulesConfig,
  RoomRulesConfig,
  RoomView,
} from "../../core/network/RealtimeClient";
import { theme } from "../../core/theme/Theme";
import { playerPlate } from "../../ui/GameTableUi";
import { button, chip, clearChildren, panel, text } from "../../ui/UiKit";
import {
  createDefaultRoomRules,
  orderRoomPlayerNames,
  resolveRoomRules,
  roomRuleSummary,
} from "./FriendRoomRules";

const { ccclass } = _decorator;

export interface PlaytestLaunchOptions {
  rulesConfig?: RoomRulesConfig;
  playerNames?: readonly string[];
}

interface LobbyActions {
  ensureConnected(): Promise<void>;
  createRoom(
    gameId: FriendRoomGameId,
    rulesConfig: FriendRoomRulesConfig,
  ): Promise<RoomView>;
  joinRoom(roomCode: string): Promise<RoomView>;
  setReady(ready: boolean): Promise<RoomView>;
  addBot(): Promise<RoomView>;
  removeBot(botUserId: string): Promise<RoomView>;
  leaveRoom(): Promise<void>;
  currentUserId(): string | undefined;
  startPlaytest(gameId: string, options?: PlaytestLaunchOptions): void;
}

type ModalState =
  | { kind: "none" }
  | {
      kind: "create";
      gameId: FriendRoomGameId;
      rulesConfig: FriendRoomRulesConfig;
    }
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
    ensureConnected: () => Promise.reject(new Error("大厅尚未连接服务")),
    createRoom: () => Promise.reject(new Error("大厅尚未连接服务")),
    joinRoom: () => Promise.reject(new Error("大厅尚未连接服务")),
    setReady: () => Promise.reject(new Error("大厅尚未连接服务")),
    addBot: () => Promise.reject(new Error("大厅尚未连接服务")),
    removeBot: () => Promise.reject(new Error("大厅尚未连接服务")),
    leaveRoom: () => Promise.reject(new Error("大厅尚未连接服务")),
    currentUserId: () => undefined,
    startPlaytest: () => undefined,
  };

  configure(displayName: string, actions: LobbyActions): void {
    this.displayName = displayName;
    this.actions = actions;
  }

  setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    if (this.node.activeInHierarchy) this.render();
  }

  presentInvite(roomCode: string): void {
    this.roomCode = roomCode;
    this.modal = { kind: "join" };
  }

  updateRoom(room: RoomView): void {
    if (this.modal.kind !== "room") return;
    this.modal = { ...this.modal, room };
    if (this.node.activeInHierarchy) this.render();
  }

  notify(message: string): void {
    this.showToast(message);
  }

  refresh(): void {
    if (this.node.activeInHierarchy) this.render();
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
    playerPlate(this.node, "LobbyGuide", {
      x: 792,
      y: 148,
      width: 224,
      height: 136,
      avatar: "林",
      avatarResourcePath: "ui/characters/portrait-linxi",
      name: "林溪",
      detail: "今晚开一桌？\n斗地主与麻将均可试玩",
      accent: "#2C7A69",
    });
    button(
      this.node,
      "QuickPlay",
      "立即试玩（单机）",
      {
        x: 1040,
        y: 146,
        width: 460,
        height: 58,
        radius: 17,
        color: theme.color.primary,
      },
      () => this.actions.startPlaytest("doudizhu"),
    );
    button(
      this.node,
      "CreateRoom",
      "创建好友房",
      {
        x: 1040,
        y: 218,
        width: 220,
        height: 50,
        radius: 17,
        color: theme.color.surfaceRaised,
        textColor: theme.color.text,
      },
      () => this.openCreate("doudizhu"),
    );
    button(
      this.node,
      "JoinRoom",
      "输入房间码",
      {
        x: 1280,
        y: 218,
        width: 220,
        height: 50,
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
      x: 1040,
      y: 278,
      width: 460,
      height: 32,
      text:
        this.connectionState === "open"
          ? "好友房服务在线 · 单机试玩始终可用"
          : this.connectionState === "connecting"
            ? "正在连接好友房服务…"
            : "好友房未连接 · 创建或加入时会自动重连",
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
    if (this.modal.kind === "create")
      this.renderCreateModal(this.modal.gameId, this.modal.rulesConfig);
    if (this.modal.kind === "join") this.renderJoinModal();
    if (this.modal.kind === "room")
      this.renderRoomModal(this.modal.title, this.modal.room);
  }

  private renderCreateModal(
    gameId: FriendRoomGameId,
    rulesConfig: FriendRoomRulesConfig,
  ): void {
    const game = getGame(gameId);
    if (!game) return;
    panel(this.node, "CreateModal", {
      x: 330,
      y: 54,
      width: 940,
      height: 792,
      radius: 24,
      color: theme.color.surface,
      stroke: theme.color.outline,
      strokeWidth: 2,
    });
    text(this.node, "CreateTitle", {
      x: 382,
      y: 92,
      width: 836,
      height: 48,
      text: `创建${game.name}好友房`,
      fontSize: 30,
      bold: true,
    });
    text(this.node, "CreateDescription", {
      x: 382,
      y: 146,
      width: 836,
      height: 48,
      text: `${game.duration} · 选择常用规则，创建后会同步给所有房间成员`,
      fontSize: 17,
      color: theme.color.textMuted,
    });

    if (rulesConfig.rulesetId === "texas-holdem.friend.v1") {
      this.renderRuleOptionRow(
        "TexasPlayers",
        "房间人数",
        222,
        [
          { label: "2 人", value: 2 },
          { label: "3 人", value: 3 },
          { label: "4 人", value: 4 },
          { label: "5 人", value: 5 },
          { label: "6 人", value: 6 },
          { label: "7 人", value: 7 },
          { label: "8 人", value: 8 },
        ] as const,
        rulesConfig.playerCount,
        (playerCount) => this.setCreateRules({ ...rulesConfig, playerCount }),
      );
      this.renderRuleOptionRow(
        "TexasChips",
        "初始筹码",
        310,
        [
          { label: "500", value: 500 },
          { label: "1000", value: 1000 },
          { label: "2000", value: 2000 },
        ] as const,
        rulesConfig.startingChips,
        (startingChips) =>
          this.setCreateRules({ ...rulesConfig, startingChips }),
      );
      this.renderRuleOptionRow(
        "TexasBlind",
        "盲注",
        398,
        [
          { label: "5 / 10", value: 5 },
          { label: "10 / 20", value: 10 },
          { label: "20 / 40", value: 20 },
        ] as const,
        rulesConfig.smallBlind,
        (smallBlind) => this.setCreateRules({ ...rulesConfig, smallBlind }),
      );
      this.renderTurnSecondsRow(rulesConfig, 486);
    } else if (rulesConfig.rulesetId === "doudizhu.friend.v1") {
      this.renderRoundCountRow(rulesConfig, 222);
      this.renderRuleOptionRow(
        "DoudizhuMultiplier",
        "倍数上限",
        310,
        [
          { label: "32 倍", value: 32 },
          { label: "64 倍", value: 64 },
          { label: "128 倍", value: 128 },
        ] as const,
        rulesConfig.multiplierCap,
        (multiplierCap) =>
          this.setCreateRules({ ...rulesConfig, multiplierCap }),
      );
      this.renderTurnSecondsRow(rulesConfig, 398);
      this.renderRuleOptionRow(
        "DoudizhuAutoPlay",
        "超时托管",
        486,
        [
          { label: "允许", value: true },
          { label: "关闭", value: false },
        ] as const,
        rulesConfig.allowAutoPlay,
        (allowAutoPlay) =>
          this.setCreateRules({ ...rulesConfig, allowAutoPlay }),
      );
    } else {
      this.renderRoundCountRow(rulesConfig, 222);
      this.renderTurnSecondsRow(rulesConfig, 310);
      this.renderRuleOptionRow(
        "MahjongSevenPairs",
        "七对",
        398,
        [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ] as const,
        rulesConfig.allowSevenPairs,
        (allowSevenPairs) =>
          this.setCreateRules({ ...rulesConfig, allowSevenPairs }),
      );
      this.renderRuleOptionRow(
        "MahjongMultiWin",
        "点炮规则",
        486,
        [
          { label: "一炮多响", value: true },
          { label: "截胡", value: false },
        ] as const,
        rulesConfig.allowMultipleWinners,
        (allowMultipleWinners) =>
          this.setCreateRules({ ...rulesConfig, allowMultipleWinners }),
      );
    }

    panel(this.node, "RuleSummary", {
      x: 382,
      y: 584,
      width: 836,
      height: 92,
      radius: 18,
      color: theme.color.surfaceRaised,
    });
    text(this.node, "RuleSummaryText", {
      x: 410,
      y: 594,
      width: 780,
      height: 72,
      text: `规则摘要\n${roomRuleSummary(rulesConfig)}`,
      fontSize: 16,
      lineHeight: 30,
      color: theme.color.text,
    });
    button(
      this.node,
      "CreateCancel",
      "取消",
      {
        x: 382,
        y: 724,
        width: 220,
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
      this.busy
        ? this.connectionState === "open"
          ? "创建中…"
          : "正在连接…"
        : this.connectionState === "open"
          ? "确认创建"
          : "连接并创建",
      {
        x: 982,
        y: 724,
        width: 236,
        height: 58,
        radius: 16,
        enabled: !this.busy,
      },
      () => void this.createRoom(gameId, rulesConfig),
    );
    button(
      this.node,
      "CreatePlaytest",
      "单机试玩",
      {
        x: 622,
        y: 724,
        width: 340,
        height: 58,
        radius: 16,
        color: theme.color.surfaceRaised,
        textColor: theme.color.text,
      },
      () => {
        this.modal = { kind: "none" };
        this.actions.startPlaytest(game.id, { rulesConfig });
      },
    );
  }

  private renderRuleOptionRow<T extends string | number | boolean>(
    name: string,
    label: string,
    y: number,
    options: readonly { label: string; value: T }[],
    selected: T,
    onSelect: (value: T) => void,
  ): void {
    text(this.node, `${name}Label`, {
      x: 382,
      y: y + 16,
      width: 168,
      height: 44,
      text: label,
      fontSize: 18,
      bold: true,
    });
    const optionGap = options.length > 4 ? 8 : 14;
    const optionWidth =
      options.length > 4
        ? (648 - optionGap * (options.length - 1)) / options.length
        : options.length === 2
          ? 250
          : 184;
    options.forEach((option, index) => {
      const active = option.value === selected;
      button(
        this.node,
        `${name}-${index}`,
        option.label,
        {
          x: 570 + index * (optionWidth + optionGap),
          y,
          width: optionWidth,
          height: 58,
          radius: 14,
          color: active ? theme.color.primaryStrong : theme.color.surfaceRaised,
          textColor: active ? theme.color.background : theme.color.textMuted,
        },
        () => onSelect(option.value),
      );
    });
  }

  private renderRoundCountRow(
    rulesConfig: Extract<
      FriendRoomRulesConfig,
      {
        rulesetId: "doudizhu.friend.v1" | "guizhou-mahjong.friend.v1";
      }
    >,
    y: number,
  ): void {
    this.renderRuleOptionRow(
      "RoundCount",
      "对局局数",
      y,
      [
        { label: "1 局", value: 1 },
        { label: "4 局", value: 4 },
        { label: "8 局", value: 8 },
      ] as const,
      rulesConfig.roundCount,
      (roundCount) => this.setCreateRules({ ...rulesConfig, roundCount }),
    );
  }

  private renderTurnSecondsRow(
    rulesConfig: FriendRoomRulesConfig,
    y: number,
  ): void {
    this.renderRuleOptionRow(
      "TurnSeconds",
      "操作时间",
      y,
      [
        { label: "15 秒", value: 15 },
        { label: "30 秒", value: 30 },
        { label: "60 秒", value: 60 },
      ] as const,
      rulesConfig.turnSeconds,
      (turnSeconds) => this.setCreateRules({ ...rulesConfig, turnSeconds }),
    );
  }

  private setCreateRules(rulesConfig: FriendRoomRulesConfig): void {
    if (this.modal.kind !== "create") return;
    this.modal = { ...this.modal, rulesConfig };
    this.render();
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
      this.busy
        ? this.connectionState === "open"
          ? "加入中…"
          : "正在连接…"
        : this.connectionState === "open"
          ? "加入房间"
          : "连接并加入",
      {
        x: 726,
        y: 656,
        width: 360,
        height: 58,
        radius: 16,
        enabled: this.roomCode.length === 6 && !this.busy,
      },
      () => void this.joinRoom(),
    );
  }

  private renderRoomModal(title: string, room: RoomView): void {
    const rulesConfig = resolveRoomRules(room.gameId, room.rulesConfig);
    panel(this.node, "RoomModal", {
      x: 220,
      y: 92,
      width: 1160,
      height: 716,
      radius: 24,
      color: theme.color.surface,
      stroke: theme.color.primaryStrong,
      strokeWidth: 2,
    });
    text(this.node, "RoomTitle", {
      x: 270,
      y: 126,
      width: 520,
      height: 44,
      text: title,
      fontSize: 28,
      bold: true,
    });
    const gameName = getGame(room.gameId)?.name ?? room.gameId;
    text(this.node, "RoomGame", {
      x: 270,
      y: 174,
      width: 520,
      height: 28,
      text: `${gameName} · ${roomRuleSummary(rulesConfig)}`,
      fontSize: 15,
      color: theme.color.textMuted,
    });
    text(this.node, "RoomCodeLabel", {
      x: 850,
      y: 122,
      width: 180,
      height: 28,
      text: "房间码",
      fontSize: 14,
      color: theme.color.textMuted,
      align: HorizontalTextAlignment.RIGHT,
    });
    text(this.node, "RoomCode", {
      x: 850,
      y: 146,
      width: 180,
      height: 48,
      text: `${room.roomCode.slice(0, 3)}  ${room.roomCode.slice(3)}`,
      fontSize: 30,
      bold: true,
      color: theme.color.primary,
      align: HorizontalTextAlignment.RIGHT,
    });
    button(
      this.node,
      "ShareRoom",
      "分享 / 复制房间码",
      {
        x: 1060,
        y: 132,
        width: 270,
        height: 56,
        radius: 15,
      },
      () => this.shareRoom(room),
    );

    const seatCount = rulesConfig.playerCount;
    const selfUserId = this.actions.currentUserId();
    const selfIsHost = selfUserId === room.hostUserId;
    const compactSeats = seatCount > 4;
    const seatColumns = compactSeats ? 4 : seatCount;
    const seatGap = 18;
    const seatWidth = (1060 - seatGap * (seatColumns - 1)) / seatColumns;
    for (let index = 0; index < seatCount; index += 1) {
      const member = room.members[index];
      const seatColumn = index % seatColumns;
      const seatRow = Math.floor(index / seatColumns);
      const x = 270 + seatColumn * (seatWidth + seatGap);
      const y = compactSeats ? 218 + seatRow * 128 : 236;
      const avatarSize = compactSeats ? 64 : 96;
      const avatarX = compactSeats
        ? x + 14
        : x + seatWidth / 2 - avatarSize / 2;
      const avatarY = compactSeats ? y + 14 : 268;
      const contentX = compactSeats ? avatarX + avatarSize + 14 : x + 12;
      const contentWidth = compactSeats
        ? x + seatWidth - 14 - contentX
        : seatWidth - 24;
      panel(this.node, `Seat-${index}`, {
        x,
        y,
        width: seatWidth,
        height: compactSeats ? 112 : 250,
        radius: 20,
        color: theme.color.surfaceRaised,
        stroke: member?.ready ? theme.color.accent : theme.color.outline,
      });
      panel(this.node, `SeatAvatar-${index}`, {
        x: avatarX,
        y: avatarY,
        width: avatarSize,
        height: avatarSize,
        radius: avatarSize / 2,
        color: member ? theme.color.primaryStrong : theme.color.outline,
      });
      text(this.node, `SeatAvatarText-${index}`, {
        x: avatarX,
        y: avatarY,
        width: avatarSize,
        height: avatarSize,
        text: member ? member.displayName.slice(0, 1) : "+",
        fontSize: compactSeats ? 28 : 40,
        bold: true,
        align: HorizontalTextAlignment.CENTER,
      });
      const isSelf = member?.userId === selfUserId;
      const isHost = member?.userId === room.hostUserId;
      text(this.node, `SeatName-${index}`, {
        x: contentX,
        y: compactSeats ? y + 10 : 374,
        width: contentWidth,
        height: compactSeats ? 28 : 34,
        text: member
          ? `${member.isBot ? "人机 · " : ""}${member.displayName}${isSelf ? "（我）" : ""}`
          : "等待好友加入",
        fontSize: compactSeats ? 16 : 19,
        bold: Boolean(member),
        color: member ? theme.color.text : theme.color.textMuted,
        align: HorizontalTextAlignment.CENTER,
      });
      text(this.node, `SeatStatus-${index}`, {
        x: contentX,
        y: compactSeats ? y + 40 : 410,
        width: contentWidth,
        height: compactSeats ? 30 : 26,
        text: member
          ? `${isHost ? "房主 · " : ""}${member.connected ? (member.ready ? "已准备" : "未准备") : "离线保留席位"}`
          : selfIsHost
            ? "可添加人机补位"
            : "等待房主补位或好友加入",
        fontSize: compactSeats ? 12 : 14,
        color: member?.ready ? theme.color.accent : theme.color.textMuted,
        align: HorizontalTextAlignment.CENTER,
      });
      if (selfIsHost && (!member || member.isBot)) {
        button(
          this.node,
          `SeatBotAction-${index}`,
          this.busy ? "处理中…" : member ? "移除人机" : "添加人机",
          {
            x: compactSeats ? contentX : x + 18,
            y: compactSeats ? y + 74 : 446,
            width: compactSeats ? contentWidth : seatWidth - 36,
            height: compactSeats ? 28 : 30,
            radius: 10,
            color: theme.color.surface,
            textColor: member ? theme.color.textMuted : theme.color.accent,
            enabled: !this.busy,
          },
          () =>
            member ? void this.removeBot(member.userId) : void this.addBot(),
        );
      }
    }

    panel(this.node, "RoomRules", {
      x: 270,
      y: 514,
      width: 1060,
      height: 104,
      radius: 18,
      color: "#123A37",
    });
    text(this.node, "RoomRulesTitle", {
      x: 300,
      y: 530,
      width: 190,
      height: 28,
      text: "本局规则",
      fontSize: 17,
      bold: true,
      color: theme.color.primary,
    });
    text(this.node, "RoomRulesSummary", {
      x: 300,
      y: 560,
      width: 990,
      height: 38,
      text: roomRuleSummary(rulesConfig),
      fontSize: 16,
      color: theme.color.textMuted,
    });

    const selfMember = room.members.find(
      (member) => member.userId === selfUserId,
    );
    const allReady =
      room.members.length === seatCount &&
      room.members.every((member) => member.ready && member.connected);
    text(this.node, "RoomReadiness", {
      x: 270,
      y: 648,
      width: 650,
      height: 32,
      text: allReady
        ? "全员已准备，可以进入下一阶段"
        : `${room.members.filter((member) => member.ready).length}/${seatCount} 位玩家已准备`,
      fontSize: 16,
      color: allReady ? theme.color.accent : theme.color.textMuted,
    });
    button(
      this.node,
      "LeaveRoom",
      "离开房间",
      {
        x: 270,
        y: 704,
        width: 250,
        height: 62,
        radius: 16,
        color: theme.color.surfaceRaised,
        textColor: theme.color.text,
        enabled: !this.busy,
      },
      () => void this.leaveRoom(),
    );
    button(
      this.node,
      "ReadyRoom",
      this.busy ? "处理中…" : selfMember?.ready ? "取消准备" : "准备",
      {
        x: 800,
        y: 704,
        width: selfIsHost ? 250 : 530,
        height: 62,
        radius: 16,
        color: selfMember?.ready
          ? theme.color.surfaceRaised
          : theme.color.primary,
        textColor: selfMember?.ready
          ? theme.color.text
          : theme.color.background,
        enabled: Boolean(selfMember) && !this.busy,
      },
      () => void this.setReady(!(selfMember?.ready ?? false)),
    );
    if (selfIsHost) {
      button(
        this.node,
        "StartRoom",
        allReady ? "开始游戏" : "等待全员准备",
        {
          x: 1070,
          y: 704,
          width: 260,
          height: 62,
          radius: 16,
          enabled: allReady && !this.busy,
        },
        () =>
          this.actions.startPlaytest(room.gameId, {
            rulesConfig,
            playerNames: orderRoomPlayerNames(room.members, selfUserId),
          }),
      );
    }
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
    if (!isFriendRoomGameId(gameId)) {
      this.showToast("该玩法暂不支持创建好友房");
      return;
    }
    this.modal = {
      kind: "create",
      gameId,
      rulesConfig: createDefaultRoomRules(gameId),
    };
    this.render();
  }

  private async createRoom(
    gameId: FriendRoomGameId,
    rulesConfig: FriendRoomRulesConfig,
  ): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      await this.actions.ensureConnected();
      const room = await this.actions.createRoom(gameId, rulesConfig);
      this.modal = { kind: "room", title: "好友房创建成功", room };
    } catch (error) {
      this.modal = { kind: "create", gameId, rulesConfig };
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
      await this.actions.ensureConnected();
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

  private async setReady(ready: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      const room = await this.actions.setReady(ready);
      const title =
        this.modal.kind === "room" ? this.modal.title : "好友候场房";
      this.modal = { kind: "room", title, room };
      this.showToast(ready ? "已准备，等待其他玩家" : "已取消准备");
    } catch (error) {
      this.showToast(
        error instanceof Error ? error.message : "准备状态更新失败",
      );
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async addBot(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      const room = await this.actions.addBot();
      const title =
        this.modal.kind === "room" ? this.modal.title : "好友候场房";
      this.modal = { kind: "room", title, room };
      this.showToast("已添加策略人机并自动准备");
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : "添加人机失败");
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async removeBot(botUserId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      const room = await this.actions.removeBot(botUserId);
      const title =
        this.modal.kind === "room" ? this.modal.title : "好友候场房";
      this.modal = { kind: "room", title, room };
      this.showToast("已移除人机");
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : "移除人机失败");
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async leaveRoom(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      await this.actions.leaveRoom();
      this.modal = { kind: "none" };
      this.showToast("已离开房间");
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : "离开房间失败");
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private shareRoom(room: RoomView): void {
    const globals = globalThis as typeof globalThis & {
      wx?: {
        shareAppMessage?(options: { title: string; query: string }): void;
        setClipboardData?(options: { data: string }): void;
      };
    };
    const title = `来和我一起玩${getGame(room.gameId)?.name ?? "桌游"}`;
    if (globals.wx?.shareAppMessage) {
      globals.wx.shareAppMessage({
        title,
        query: `roomCode=${room.roomCode}`,
      });
      this.showToast("已打开微信分享");
      return;
    }
    globals.wx?.setClipboardData?.({ data: room.roomCode });
    this.showToast(`房间码 ${room.roomCode}`);
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

function isFriendRoomGameId(gameId: string): gameId is FriendRoomGameId {
  return (
    gameId === "texas-holdem" ||
    gameId === "doudizhu" ||
    gameId === "guizhou-mahjong"
  );
}
