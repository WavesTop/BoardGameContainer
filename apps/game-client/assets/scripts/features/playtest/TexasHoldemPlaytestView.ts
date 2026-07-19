import {
  _decorator,
  Component,
  EditBox,
  HorizontalTextAlignment,
  Node,
} from "cc";

import { theme } from "../../core/theme/Theme";
import { playerPlate, playingCard, tableBackdrop } from "../../ui/GameTableUi";
import { button, clearChildren, panel, text } from "../../ui/UiKit";
import {
  actTexas,
  chooseTexasAiAction,
  createTexasState,
  evaluateBestHand,
  legalTexasActions,
  pokerCardText,
  startTexasHand,
  texasRaiseBounds,
  type PokerCard,
  type TexasAction,
  type TexasRaiseBounds,
  type TexasState,
} from "./TexasHoldemPlaytestModel";

const { ccclass } = _decorator;

const DEFAULT_TEXAS_PLAYER_NAMES = [
  "我",
  "阿策",
  "小满",
  "老周",
  "七喜",
  "南风",
  "石榴",
  "北辰",
] as const;

export interface TexasPlaytestSetup {
  playerCount?: number;
  playerNames?: readonly string[];
  startingChips?: number;
  smallBlind?: number;
}

@ccclass("TexasHoldemPlaytestView")
export class TexasHoldemPlaytestView extends Component {
  private state?: TexasState;
  private aiTimer?: ReturnType<typeof setTimeout>;
  private raiseDraft = "";
  private raiseDraftContext = "";
  private exitAction: () => void = () => undefined;

  configure(exitAction: () => void): void {
    this.exitAction = exitAction;
  }

  startNewMatch(setup: TexasPlaytestSetup = {}): void {
    this.clearAiTimer();
    this.raiseDraft = "";
    this.raiseDraftContext = "";
    const playerCount = setup.playerNames?.length ?? setup.playerCount ?? 4;
    const playerNames =
      setup.playerNames ?? DEFAULT_TEXAS_PLAYER_NAMES.slice(0, playerCount);
    this.state = createTexasState(playerNames, Math.random, {
      startingChips: setup.startingChips,
      smallBlind: setup.smallBlind,
    });
    this.render();
    this.scheduleAi();
  }

  protected override start(): void {
    if (!this.state) this.startNewMatch();
  }

  protected override onDisable(): void {
    this.clearAiTimer();
  }

  protected override onDestroy(): void {
    this.clearAiTimer();
  }

  private render(): void {
    const state = this.state;
    if (!state) return;
    clearChildren(this.node);
    tableBackdrop(
      this.node,
      "TexasBackground",
      "ui/table-backgrounds/texas-table",
      "#071228",
    );
    panel(this.node, "TexasTopShade", {
      x: 0,
      y: 0,
      width: 1600,
      height: 108,
      color: "#040A1B",
      alpha: 190,
    });
    panel(this.node, "TexasBottomShade", {
      x: 0,
      y: 782,
      width: 1600,
      height: 118,
      color: "#030819",
      alpha: 226,
    });
    this.renderTopBar(state);
    this.renderPlayers(state);
    this.renderBoard(state);
    this.renderActions(state);
  }

  private renderTopBar(state: TexasState): void {
    panel(this.node, "TexasTopBar", {
      x: 18,
      y: 16,
      width: 1564,
      height: 62,
      radius: 31,
      color: "#08162B",
      alpha: 222,
      stroke: "#506A91",
    });
    button(
      this.node,
      "TexasBack",
      "‹  大厅",
      {
        x: 32,
        y: 24,
        width: 132,
        height: 46,
        radius: 18,
        color: "#243B5C",
        stroke: "#6D86AA",
        textColor: theme.color.text,
      },
      () => this.leave(),
    );
    text(this.node, "TexasTitle", {
      x: 186,
      y: 22,
      width: 570,
      height: 48,
      text: `德州扑克  ·  好友局  #${state.handNumber}`,
      fontSize: 26,
      bold: true,
      color: "#FFF5D1",
    });
    text(this.node, "TexasRules", {
      x: 770,
      y: 22,
      width: 610,
      height: 48,
      text: `盲注 ${state.smallBlind} / ${state.bigBlind}    起始 ${state.startingChips.toLocaleString()}    第 ${state.handNumber} 手`,
      fontSize: 16,
      color: "#B8C9E2",
      align: HorizontalTextAlignment.RIGHT,
    });
    button(
      this.node,
      "TexasHistory",
      "牌谱",
      {
        x: 1400,
        y: 24,
        width: 76,
        height: 46,
        radius: 18,
        color: "#243B5C",
        stroke: "#6D86AA",
        textColor: theme.color.text,
      },
      () => undefined,
    );
    button(
      this.node,
      "TexasMenu",
      "☰",
      {
        x: 1486,
        y: 24,
        width: 76,
        height: 46,
        radius: 18,
        color: "#243B5C",
        stroke: "#6D86AA",
        textColor: theme.color.text,
      },
      () => undefined,
    );
  }

  private renderPlayers(state: TexasState): void {
    const positions = texasSeatPositions(state.players.length);
    const compact = state.players.length > 4;
    state.players.forEach((player, index) => {
      const position = positions[index];
      if (!position) return;
      const active =
        state.phase !== "finished" && state.currentPlayerIndex === index;
      const status = player.folded
        ? "已弃牌"
        : player.allIn
          ? "ALL IN"
          : player.streetBet > 0
            ? `已下注 ${player.streetBet}`
            : active
              ? "正在思考…"
              : "等待行动";
      playerPlate(this.node, `TexasPlayer-${index}`, {
        x: position.x,
        y: position.y,
        width: index === 0 || !compact ? 300 : 230,
        height: index === 0 || !compact ? 94 : 76,
        avatar: index === 0 ? "我" : player.name.slice(0, 1),
        name: player.name,
        detail: `筹码  ${player.stack.toLocaleString()}\n${status}`,
        active,
        dealer: index === state.dealerIndex,
        accent:
          [
            "#8A5A73",
            "#415D9A",
            "#735196",
            "#397B72",
            "#9A673E",
            "#566E9F",
            "#8B5268",
            "#3F7E89",
          ][index] ?? "#735196",
      });
      const reveal =
        index === 0 || (state.phase === "finished" && !player.folded);
      const cardWidth = index === 0 ? 90 : compact ? 44 : 50;
      const cardHeight = index === 0 ? 128 : compact ? 66 : 76;
      const cardGap = index === 0 ? 102 : compact ? 48 : 54;
      player.holeCards.forEach((card, cardIndex) => {
        this.renderCard(
          `TexasHole-${index}-${cardIndex}`,
          reveal ? card : undefined,
          position.cardX + cardIndex * cardGap,
          position.cardY,
          cardWidth,
          cardHeight,
          !reveal,
        );
      });
    });
  }

  private renderBoard(state: TexasState): void {
    panel(this.node, "TexasPotBadge", {
      x: 645,
      y: 268,
      width: 310,
      height: 54,
      radius: 27,
      color: "#07382F",
      alpha: 234,
      stroke: "#37D4B5",
      strokeWidth: 2,
    });
    text(this.node, "TexasPot", {
      x: 645,
      y: 268,
      width: 310,
      height: 54,
      text: `底池  ${state.pot.toLocaleString()}   ·   ${phaseText(state.phase)}`,
      fontSize: 21,
      bold: true,
      color: "#FFF2AA",
      align: HorizontalTextAlignment.CENTER,
    });
    for (let index = 0; index < 5; index += 1) {
      panel(this.node, `TexasPotChip-${index}`, {
        x: 750 + index * 24,
        y: 326 - Math.abs(2 - index) * 3,
        width: 46,
        height: 17,
        radius: 9,
        color: ["#C13E48", "#674BC6", "#E2B33F", "#2CB7A0", "#C13E48"][index],
        stroke: "#F1D79B",
      });
    }
    panel(this.node, "TexasBoardLane", {
      x: 498,
      y: 350,
      width: 604,
      height: 152,
      radius: 28,
      color: "#063B32",
      alpha: 98,
      stroke: "#45B7A5",
    });
    for (let index = 0; index < 5; index += 1) {
      this.renderCard(
        `TexasBoard-${index}`,
        state.communityCards[index],
        520 + index * 112,
        360,
        90,
        128,
        false,
      );
    }
    let handLabel = "等待公共牌";
    if (state.communityCards.length >= 3) {
      handLabel = evaluateBestHand([
        ...(state.players[0]?.holeCards ?? []),
        ...state.communityCards,
      ]).label;
    }
    text(this.node, "TexasMessage", {
      x: 410,
      y: 506,
      width: 780,
      height: 44,
      text: `${state.message}\n你的当前牌力：${handLabel}`,
      fontSize: 16,
      lineHeight: 21,
      color: "#D7FFF4",
      align: HorizontalTextAlignment.CENTER,
    });
  }

  private renderCard(
    name: string,
    card: PokerCard | undefined,
    x: number,
    y: number,
    width: number,
    height: number,
    hidden = false,
  ): void {
    if (!card && !hidden) {
      panel(this.node, name, {
        x,
        y,
        width,
        height,
        radius: width > 70 ? 10 : 7,
        color: "#075D50",
        alpha: 96,
        stroke: "#3CB9A4",
        strokeWidth: 2,
      });
      text(this.node, `${name}EmptyMark`, {
        x,
        y,
        width,
        height,
        text: "◆",
        fontSize: Math.max(14, Math.round(width * 0.24)),
        color: "#61C8B6",
        align: HorizontalTextAlignment.CENTER,
      });
      return;
    }
    playingCard(this.node, name, {
      x,
      y,
      width,
      height,
      radius: width > 70 ? 10 : 7,
      label: card ? pokerCardText(card) : undefined,
      red: card?.suit === "heart" || card?.suit === "diamond",
      back: hidden,
    });
  }

  private renderActions(state: TexasState): void {
    panel(this.node, "TexasActions", {
      x: 32,
      y: 792,
      width: 1536,
      height: 96,
      radius: 30,
      color: "#08142B",
      alpha: 248,
      stroke: "#3E557C",
      strokeWidth: 2,
    });
    if (state.phase === "finished") {
      text(this.node, "TexasResult", {
        x: 72,
        y: 805,
        width: 1128,
        height: 64,
        text: state.message,
        fontSize: 24,
        bold: true,
        color: theme.color.accent,
        align: HorizontalTextAlignment.CENTER,
      });
      button(
        this.node,
        "TexasNextHand",
        "下一手",
        {
          x: 1250,
          y: 805,
          width: 246,
          height: 64,
          radius: 18,
          color: "#E5B840",
          stroke: "#FFF0A8",
        },
        () => this.nextHand(),
      );
      return;
    }
    const legal = legalTexasActions(state, 0);
    const player = state.players[0];
    const toCall = Math.max(0, state.currentBet - (player?.streetBet ?? 0));
    const actions: readonly {
      name: string;
      label: string;
      action: TexasAction;
      enabled: boolean;
      x: number;
      width: number;
      color: string;
      stroke: string;
    }[] = [
      {
        name: "TexasFold",
        label: "弃牌",
        action: { type: "fold" },
        enabled: legal.includes("fold"),
        x: 72,
        width: 244,
        color: "#B33D49",
        stroke: "#E8747D",
      },
      {
        name: "TexasCheck",
        label:
          toCall > 0 ? `跟注 ${Math.min(toCall, player?.stack ?? 0)}` : "过牌",
        action: toCall > 0 ? { type: "call" } : { type: "check" },
        enabled: legal.includes(toCall > 0 ? "call" : "check"),
        x: 342,
        width: 246,
        color: "#315D9C",
        stroke: "#74A6E6",
      },
      {
        name: "TexasAllIn",
        label: "全下",
        action: { type: "allIn" },
        enabled: legal.includes("allIn"),
        x: 1250,
        width: 246,
        color: "#BF3E81",
        stroke: "#E67BB1",
      },
    ];
    actions.forEach((item) => {
      button(
        this.node,
        item.name,
        item.label,
        {
          x: item.x,
          y: 805,
          width: item.width,
          height: 64,
          radius: 18,
          color: item.color,
          stroke: item.enabled ? item.stroke : "#4D5870",
          strokeWidth: 2,
          textColor: theme.color.text,
          enabled: item.enabled,
        },
        () => this.act(item.action),
      );
    });
    const bounds = texasRaiseBounds(state, 0);
    const raiseEnabled = legal.includes("raise") && bounds !== undefined;
    this.prepareRaiseDraft(state, bounds);
    this.renderRaiseInput(bounds, raiseEnabled);
  }

  private prepareRaiseDraft(
    state: TexasState,
    bounds: TexasRaiseBounds | undefined,
  ): void {
    const player = state.players[0];
    const context = `${state.handNumber}:${state.phase}:${state.currentBet}:${player?.streetBet ?? 0}:${player?.stack ?? 0}`;
    if (context === this.raiseDraftContext) return;
    this.raiseDraftContext = context;
    this.raiseDraft = bounds ? String(bounds.minimum) : "";
  }

  private renderRaiseInput(
    bounds: TexasRaiseBounds | undefined,
    enabled: boolean,
  ): void {
    const group = panel(this.node, "TexasRaiseInputGroup", {
      x: 620,
      y: 805,
      width: 598,
      height: 64,
      radius: 20,
      color: enabled ? "#4A2B82" : "#2A3141",
      stroke: enabled ? "#B68AE8" : "#4D5870",
      strokeWidth: 2,
    });
    if (enabled) {
      panel(group, "TexasRaiseSheen", {
        x: 3,
        y: 3,
        width: 592,
        height: 19,
        radius: 17,
        color: "#FFFFFF",
        alpha: 26,
      });
    }
    text(group, "TexasRaiseInputCaption", {
      x: 14,
      y: 0,
      width: 102,
      height: 64,
      text: "加注至",
      fontSize: 18,
      bold: true,
      color: enabled ? theme.color.text : theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });
    panel(group, "TexasRaiseDivider", {
      x: 118,
      y: 12,
      width: 1,
      height: 40,
      color: enabled ? "#B08CDA" : "#465064",
    });
    const field = panel(group, "TexasRaiseInput", {
      x: 130,
      y: 6,
      width: 230,
      height: 52,
      radius: 12,
      color: "#17152F",
      stroke: enabled ? "#7755A8" : "#4D5870",
    });
    const inputLabel = text(field, "TEXT_LABEL", {
      x: 10,
      y: 0,
      width: 210,
      height: 33,
      text: this.raiseDraft,
      fontSize: 26,
      bold: true,
      color: enabled ? "#FFF4D2" : theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });
    text(field, "TexasRaiseInputRange", {
      x: 10,
      y: 31,
      width: 210,
      height: 17,
      text: bounds
        ? bounds.minimum === bounds.maximum
          ? bounds.minimum.toLocaleString()
          : `${bounds.minimum.toLocaleString()}–${bounds.maximum.toLocaleString()}`
        : "不可用",
      fontSize: 11,
      color: enabled ? "#C7B6E7" : theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });
    const placeholderLabel = text(field, "PLACEHOLDER_LABEL", {
      x: 8,
      y: 0,
      width: 214,
      height: 52,
      text: "输入筹码",
      fontSize: 14,
      color: theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });
    // Configure the input mode before Cocos creates the native Web control.
    // Otherwise the component preloads with its multiline default and exposes
    // a textarea scrollbar while editing, even after switching to phone input.
    field.active = false;
    const editBox = field.addComponent(EditBox);
    editBox.textLabel = inputLabel;
    editBox.placeholderLabel = placeholderLabel;
    editBox.string = this.raiseDraft;
    editBox.placeholder = "输入筹码";
    editBox.inputMode = EditBox.InputMode.PHONE_NUMBER;
    editBox.inputFlag = EditBox.InputFlag.DEFAULT;
    editBox.returnType = EditBox.KeyboardReturnType.DONE;
    editBox.maxLength = 7;
    editBox.enabled = enabled;
    field.on(EditBox.EventType.TEXT_CHANGED, (changed: EditBox) => {
      const digits = changed.string.replace(/\D/g, "").slice(0, 7);
      if (digits !== changed.string) changed.string = digits;
      this.raiseDraft = digits;
    });
    field.on(EditBox.EventType.EDITING_RETURN, () => {
      if (enabled) this.submitRaise(bounds);
    });
    field.active = true;
    button(
      group,
      "TexasRaise",
      "确认加注",
      {
        x: 374,
        y: 6,
        width: 212,
        height: 52,
        radius: 14,
        color: enabled ? "#7650C8" : "#40485A",
        stroke: enabled ? "#F0B06C" : "#4D5870",
        strokeWidth: 2,
        textColor: enabled ? theme.color.text : theme.color.textMuted,
        enabled,
      },
      () => this.submitRaise(bounds),
    );
  }

  private submitRaise(bounds: TexasRaiseBounds | undefined): void {
    const state = this.state;
    if (!state || !bounds) return;
    const value = this.raiseDraft.trim();
    const raiseTo = /^\d+$/.test(value) ? Number(value) : Number.NaN;
    if (
      !Number.isSafeInteger(raiseTo) ||
      raiseTo < bounds.minimum ||
      raiseTo > bounds.maximum
    ) {
      const expected =
        bounds.minimum === bounds.maximum
          ? bounds.minimum.toLocaleString()
          : `${bounds.minimum.toLocaleString()} 到 ${bounds.maximum.toLocaleString()}`;
      state.message = `请输入 ${expected} 之间的加注总额`;
      this.render();
      return;
    }
    this.raiseDraft = "";
    this.raiseDraftContext = "";
    this.act({ type: "raise", raiseTo });
  }

  private act(action: TexasAction): void {
    if (!this.state) return;
    actTexas(this.state, 0, action);
    this.render();
    this.scheduleAi();
  }

  private nextHand(): void {
    if (!this.state) return;
    startTexasHand(this.state);
    this.render();
    this.scheduleAi();
  }

  private scheduleAi(): void {
    this.clearAiTimer();
    const state = this.state;
    if (!state || state.phase === "finished" || state.currentPlayerIndex === 0)
      return;
    this.aiTimer = setTimeout(() => {
      this.aiTimer = undefined;
      if (!this.state || !this.node.activeInHierarchy) return;
      const actor = this.state.currentPlayerIndex;
      actTexas(this.state, actor, chooseTexasAiAction(this.state, actor));
      this.render();
      this.scheduleAi();
    }, 620);
  }

  private clearAiTimer(): void {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.aiTimer = undefined;
  }

  private leave(): void {
    this.clearAiTimer();
    this.exitAction();
  }
}

interface TexasSeatPosition {
  x: number;
  y: number;
  cardX: number;
  cardY: number;
}

function texasSeatPositions(playerCount: number): readonly TexasSeatPosition[] {
  const self = { x: 650, y: 688, cardX: 704, cardY: 554 };
  const left = { x: 30, y: 328, cardX: 224, cardY: 248 };
  const top = { x: 650, y: 88, cardX: 754, cardY: 184 };
  const right = { x: 1270, y: 328, cardX: 1220, cardY: 248 };
  if (playerCount === 2) return [self, top];
  if (playerCount === 3) return [self, left, right];
  if (playerCount === 4) return [self, left, top, right];

  const leftBottom = { x: 70, y: 584, cardX: 304, cardY: 590 };
  const leftMiddle = { x: 18, y: 286, cardX: 252, cardY: 292 };
  const leftTop = { x: 320, y: 90, cardX: 389, cardY: 172 };
  const topCenter = { x: 685, y: 86, cardX: 754, cardY: 168 };
  const rightTop = { x: 1050, y: 90, cardX: 1119, cardY: 172 };
  const rightMiddle = { x: 1352, y: 286, cardX: 1200, cardY: 292 };
  const rightBottom = { x: 1300, y: 584, cardX: 1200, cardY: 590 };
  if (playerCount === 5)
    return [self, leftBottom, leftTop, rightTop, rightBottom];
  if (playerCount === 6)
    return [self, leftBottom, leftTop, topCenter, rightTop, rightBottom];
  if (playerCount === 7)
    return [
      self,
      leftBottom,
      leftMiddle,
      leftTop,
      rightTop,
      rightMiddle,
      rightBottom,
    ];
  return [
    self,
    leftBottom,
    leftMiddle,
    leftTop,
    topCenter,
    rightTop,
    rightMiddle,
    rightBottom,
  ];
}

function phaseText(phase: TexasState["phase"]): string {
  if (phase === "preflop") return "翻牌前";
  if (phase === "flop") return "翻牌圈";
  if (phase === "turn") return "转牌圈";
  if (phase === "river") return "河牌圈";
  return "本手结束";
}
