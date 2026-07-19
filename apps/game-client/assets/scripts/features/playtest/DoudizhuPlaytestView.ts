import {
  _decorator,
  Button,
  Component,
  HorizontalTextAlignment,
  Label,
  Node,
} from "cc";

import { theme } from "../../core/theme/Theme";
import { playerPlate, playingCard, tableBackdrop } from "../../ui/GameTableUi";
import { button, clearChildren, color, panel, text } from "../../ui/UiKit";
import {
  canBeat,
  classifyPlay,
  comboLabel,
  createPlaytestDeal,
  doudizhuHandPower,
  findSuggestedPlay,
  shouldCallLandlord,
  sortCards,
  type PlayCombo,
  type PlaytestCard,
} from "./DoudizhuPlaytestModel";

const { ccclass } = _decorator;

interface LastPlay {
  playerIndex: number;
  cards: PlaytestCard[];
  combo: PlayCombo;
}

const playerNames = ["我", "阿木", "小满"] as const;
const playerPortraits = [
  "ui/characters/portrait-linxi",
  "ui/characters/portrait-amu",
  "ui/characters/portrait-xiaoman",
] as const;
const handCardWidth = 116;
const handCardHeight = 170;
const handCardStep = 54;
type DoudizhuPhase = "calling" | "doubling" | "playing" | "finished";

@ccclass("DoudizhuPlaytestView")
export class DoudizhuPlaytestView extends Component {
  private hands: [PlaytestCard[], PlaytestCard[], PlaytestCard[]] = [
    [],
    [],
    [],
  ];
  private bottomCards: PlaytestCard[] = [];
  private phase: DoudizhuPhase = "calling";
  private landlordIndex?: number;
  private multiplier = 1;
  private bidMessages: [string, string, string] = ["", "", ""];
  private provisionalLandlordIndex?: number;
  private callingInProgress = false;
  private readonly selectedIds = new Set<string>();
  private currentPlayer = 0;
  private passCount = 0;
  private lastPlay?: LastPlay;
  private winner?: number;
  private statusMessage = "";
  private autoPlay = false;
  private aiTimer?: ReturnType<typeof setTimeout>;
  private renderedPlaySignature = "";
  private initialized = false;
  private exitAction: () => void = () => undefined;

  configure(exitAction: () => void): void {
    this.exitAction = exitAction;
  }

  startNewMatch(): void {
    this.clearAiTimer();
    const deal = createPlaytestDeal();
    this.hands = deal.hands;
    this.bottomCards = deal.bottomCards;
    const bottomIds = new Set(this.bottomCards.map((card) => card.id));
    this.hands[0] = this.hands[0].filter((card) => !bottomIds.has(card.id));
    this.phase = "calling";
    this.landlordIndex = undefined;
    this.multiplier = 1;
    this.bidMessages = ["", "", ""];
    this.provisionalLandlordIndex = undefined;
    this.callingInProgress = false;
    this.selectedIds.clear();
    this.currentPlayer = 0;
    this.passCount = 0;
    this.lastPlay = undefined;
    this.winner = undefined;
    this.autoPlay = false;
    this.statusMessage = "三张底牌已扣下，请选择是否叫地主";
    this.initialized = true;
    this.render();
  }

  protected override start(): void {
    if (!this.initialized) this.startNewMatch();
  }

  protected override onDisable(): void {
    this.clearAiTimer();
  }

  protected override onDestroy(): void {
    this.clearAiTimer();
  }

  private render(): void {
    clearChildren(this.node);
    this.renderBackground();
    this.renderTopBar();
    this.renderOpponents();
    this.renderTable();
    this.renderHand();
    this.renderActions();
    if (this.winner !== undefined) this.renderResult();
  }

  private renderBackground(): void {
    tableBackdrop(
      this.node,
      "TableBackground",
      "ui/table-backgrounds/doudizhu-table",
      "#07152D",
    );
    panel(this.node, "TableTopShade", {
      x: 0,
      y: 0,
      width: 1600,
      height: 104,
      color: "#140913",
      alpha: 188,
    });
    panel(this.node, "TableBottomShade", {
      x: 0,
      y: 792,
      width: 1600,
      height: 108,
      color: "#14070E",
      alpha: 232,
    });
  }

  private renderTopBar(): void {
    panel(this.node, "PlaytestTopBar", {
      x: 18,
      y: 16,
      width: 1564,
      height: 62,
      radius: 31,
      color: "#2A0F19",
      alpha: 228,
      stroke: "#A55A45",
    });
    button(
      this.node,
      "BackToLobby",
      "‹  大厅",
      {
        x: 32,
        y: 24,
        width: 132,
        height: 46,
        radius: 18,
        color: "#6E2B2B",
        stroke: "#D78D61",
        textColor: theme.color.text,
      },
      () => this.leavePlaytest(),
    );
    text(this.node, "PlaytestTitle", {
      x: 190,
      y: 22,
      width: 520,
      height: 48,
      text: "经典斗地主  ·  好友欢乐局",
      fontSize: 26,
      bold: true,
      color: "#FFF2CE",
    });
    text(this.node, "PlaytestRules", {
      x: 700,
      y: 22,
      width: 680,
      height: 46,
      text: `底分 1    倍数 ×${this.multiplier}    经典玩法    炸弹/春天翻倍`,
      fontSize: 16,
      color: "#E6C8AF",
      align: HorizontalTextAlignment.RIGHT,
    });
    button(
      this.node,
      "DoudizhuSound",
      "♫",
      {
        x: 1400,
        y: 24,
        width: 72,
        height: 46,
        radius: 18,
        color: "#6E2B2B",
        stroke: "#D78D61",
        textColor: theme.color.text,
      },
      () => undefined,
    );
    button(
      this.node,
      "DoudizhuMenu",
      "☰",
      {
        x: 1482,
        y: 24,
        width: 80,
        height: 46,
        radius: 18,
        color: "#6E2B2B",
        stroke: "#D78D61",
        textColor: theme.color.text,
      },
      () => undefined,
    );
  }

  private renderOpponents(): void {
    this.renderOpponent(1, 74, 126);
    this.renderOpponent(2, 1236, 126);
    this.renderBidBubble(1, 158, 226);
    this.renderBidBubble(2, 1292, 226);
  }

  private renderOpponent(playerIndex: 1 | 2, x: number, y: number): void {
    const active =
      this.currentPlayer === playerIndex && this.winner === undefined;
    playerPlate(this.node, `Opponent-${playerIndex}`, {
      x,
      y,
      width: 290,
      height: 96,
      avatar: playerNames[playerIndex].slice(0, 1),
      avatarResourcePath: playerPortraits[playerIndex],
      name: playerNames[playerIndex],
      detail: `${this.landlordIndex === undefined ? "等待叫地主" : this.landlordIndex === playerIndex ? "地主" : "农民"} · AI\n剩余 ${this.hands[playerIndex].length} 张`,
      active,
      dealer: this.landlordIndex === playerIndex,
      accent: playerIndex === 1 ? "#6B4DA2" : "#A15B3A",
    });
    const fanStart = playerIndex === 1 ? x + 230 : x - 62;
    for (let index = 0; index < 5; index += 1) {
      playingCard(this.node, `OpponentBack-${playerIndex}-${index}`, {
        x: fanStart + index * 12,
        y: y + 111 - Math.abs(2 - index) * 3,
        width: 46,
        height: 68,
        radius: 7,
        back: true,
      });
    }
  }

  private renderTable(): void {
    const activeName = playerNames[this.currentPlayer];
    panel(this.node, "PlayArea", {
      x: 350,
      y: 258,
      width: 900,
      height: 270,
      radius: 42,
      color: "#102F70",
      alpha: 82,
      stroke: "#87AEE4",
    });
    panel(this.node, "TurnChip", {
      x: 640,
      y: 276,
      width: 300,
      height: 42,
      radius: 21,
      color: this.currentPlayer === 0 ? "#8C4B17" : "#173E78",
      stroke: this.currentPlayer === 0 ? "#FFD76B" : "#7FB5F3",
    });
    text(this.node, "TurnText", {
      x: 640,
      y: 276,
      width: 300,
      height: 42,
      text:
        this.winner === undefined
          ? this.phase === "calling"
            ? "叫地主阶段"
            : this.phase === "doubling"
              ? "加倍阶段"
              : this.currentPlayer === 0 && this.autoPlay
                ? "我正在托管…"
                : `${activeName}${this.currentPlayer === 0 ? "的回合" : "正在思考…"}`
          : "本局已结束",
      fontSize: 18,
      bold: true,
      color:
        this.currentPlayer === 0 ? theme.color.primary : theme.color.accent,
      align: HorizontalTextAlignment.CENTER,
    });

    const playLayer = new Node("TablePlayLayer");
    this.node.addChild(playLayer);
    this.renderTablePlay(playLayer);
    this.renderedPlaySignature = this.playSignature();
    text(this.node, "PlayStatus", {
      x: 420,
      y: 484,
      width: 760,
      height: 30,
      text: this.statusMessage,
      fontSize: 16,
      color: "#FFF0B0",
      align: HorizontalTextAlignment.CENTER,
    });
  }

  private renderTablePlay(parent: Node): void {
    if (this.phase === "calling") {
      text(parent, "CallingGuide", {
        x: 500,
        y: 344,
        width: 600,
        height: 104,
        text: "叫地主\n叫中后获得三张底牌，成为地主先出牌",
        fontSize: 21,
        lineHeight: 34,
        bold: true,
        color: "#FFE8A3",
        align: HorizontalTextAlignment.CENTER,
      });
      return;
    }
    if (this.phase === "doubling") {
      text(parent, "DoublingGuide", {
        x: 500,
        y: 344,
        width: 600,
        height: 104,
        text: `${playerNames[this.landlordIndex ?? 0]}成为地主\n三张底牌已亮出，请选择本局加倍档位`,
        fontSize: 21,
        lineHeight: 34,
        bold: true,
        color: "#FFE8A3",
        align: HorizontalTextAlignment.CENTER,
      });
      return;
    }
    if (this.lastPlay) {
      text(parent, "LastPlayTitle", {
        x: 510,
        y: 346,
        width: 580,
        height: 32,
        text: `${playerNames[this.lastPlay.playerIndex]}打出 · ${comboLabel(this.lastPlay.combo)}`,
        fontSize: 16,
        color: theme.color.textMuted,
        align: HorizontalTextAlignment.CENTER,
      });
      this.renderMiniCards(parent, this.lastPlay.cards, 380);
    } else {
      text(parent, "FreeLead", {
        x: 510,
        y: 360,
        width: 580,
        height: 80,
        text: "新一轮自由出牌\n选择手牌后点击“出牌”",
        fontSize: 20,
        lineHeight: 32,
        color: "#D3DFF3",
        align: HorizontalTextAlignment.CENTER,
      });
    }
  }

  private renderMiniCards(
    parent: Node,
    cards: readonly PlaytestCard[],
    y: number,
  ): void {
    const cardWidth = 62;
    const step = 48;
    const totalWidth = cardWidth + Math.max(0, cards.length - 1) * step;
    const startX = 800 - totalWidth / 2;
    cards.forEach((card, index) => {
      playingCard(parent, `LastCard-${card.id}`, {
        x: startX + index * step,
        y,
        width: cardWidth,
        height: 88,
        radius: 9,
        label: cardText(card),
        red: isRed(card),
      });
    });
  }

  private renderHand(): void {
    const hand = this.hands[0];
    const active =
      this.phase === "playing" &&
      this.currentPlayer === 0 &&
      this.winner === undefined &&
      !this.autoPlay;
    playerPlate(this.node, "LocalPlayer", {
      x: 24,
      y: 664,
      width: 204,
      height: 92,
      avatar: "我",
      avatarResourcePath: playerPortraits[0],
      name: "林溪（我）",
      detail: `${this.landlordIndex === undefined ? "等待叫地主" : this.landlordIndex === 0 ? "地主" : "农民"}\n剩余 ${hand.length} 张`,
      active,
      dealer: this.landlordIndex === 0,
      accent: "#2C7A69",
    });
    this.renderBidBubble(0, 46, 760);
    text(this.node, "MyHandTitle", {
      x: 220,
      y: 548,
      width: 1160,
      height: 34,
      text: `我的手牌 · ${this.landlordIndex === undefined ? "身份待定" : this.landlordIndex === 0 ? "地主" : "农民"} · ${hand.length} 张`,
      fontSize: 18,
      bold: true,
      color: active ? "#FFE28A" : "#BBC7D9",
      align: HorizontalTextAlignment.CENTER,
    });
    text(this.node, "BottomCards", {
      x: 1100,
      y: 88,
      width: 410,
      height: 30,
      text:
        this.phase === "calling"
          ? "本局底牌：？  ？  ？"
          : `本局底牌：${this.bottomCards
              .map((card) => cardText(card).replace(/\s/g, ""))
              .join("  ")}`,
      fontSize: 14,
      color: "#EBCDB9",
      align: HorizontalTextAlignment.CENTER,
    });

    const totalWidth =
      handCardWidth + Math.max(0, hand.length - 1) * handCardStep;
    const startX = 800 - totalWidth / 2;
    hand.forEach((card, index) => {
      this.renderHandCard(card, startX + index * handCardStep, active);
    });
  }

  private renderHandCard(card: PlaytestCard, x: number, active: boolean): void {
    const selected = this.selectedIds.has(card.id);
    playingCard(this.node, `HandCard-${card.id}`, {
      x,
      y: selected ? 566 : 590,
      width: handCardWidth,
      height: handCardHeight,
      radius: 12,
      label: cardText(card),
      red: isRed(card),
      selected,
      enabled: active,
      onClick: () => this.toggleCard(card),
    });
  }

  private renderActions(): void {
    panel(this.node, "PlayActionsBar", {
      x: 42,
      y: 808,
      width: 1516,
      height: 78,
      radius: 28,
      color: "#250C17",
      alpha: 246,
      stroke: "#A75E45",
      strokeWidth: 2,
    });

    button(
      this.node,
      "RestartPlaytest",
      "重新发牌",
      {
        x: 60,
        y: 819,
        width: 180,
        height: 56,
        radius: 18,
        color: "#6D2B2F",
        stroke: "#C97B55",
        textColor: theme.color.text,
      },
      () => this.startNewMatch(),
    );

    if (this.phase === "calling") {
      text(this.node, "CallingStatus", {
        x: 286,
        y: 819,
        width: 510,
        height: 56,
        text: this.callingInProgress
          ? "等待其他玩家依次选择是否抢地主…"
          : "叫地主后获得底牌并先手；不叫则由电脑接任地主",
        fontSize: 16,
        color: "#F3D8B8",
        align: HorizontalTextAlignment.CENTER,
      });
      button(
        this.node,
        "DeclineLandlord",
        "不叫",
        {
          x: 840,
          y: 819,
          width: 250,
          height: 56,
          radius: 18,
          color: "#53607A",
          stroke: "#8999B7",
          textColor: theme.color.text,
          enabled: !this.callingInProgress,
        },
        () => this.chooseLandlord(false),
      );
      button(
        this.node,
        "CallLandlord",
        "叫地主",
        {
          x: 1120,
          y: 819,
          width: 340,
          height: 56,
          radius: 18,
          color: "#DB8A26",
          stroke: "#FFE49A",
          enabled: !this.callingInProgress,
        },
        () => this.chooseLandlord(true),
      );
      return;
    }

    if (this.phase === "doubling") {
      text(this.node, "DoublingStatus", {
        x: 270,
        y: 819,
        width: 330,
        height: 56,
        text: `当前倍数 ×${this.multiplier}\n请选择加倍档位`,
        fontSize: 16,
        lineHeight: 24,
        color: "#FFE5A0",
        align: HorizontalTextAlignment.CENTER,
      });
      const definitions: readonly [number, string, string][] = [
        [1, "不加倍", "#53607A"],
        [2, "加倍", "#B56C24"],
        [4, "超级加倍", "#D64A32"],
      ];
      definitions.forEach(([value, label, background], index) => {
        button(
          this.node,
          `Double-${value}`,
          label,
          {
            x: 630 + index * 280,
            y: 819,
            width: 250,
            height: 56,
            radius: 18,
            color: background,
            stroke: value === 4 ? "#FFD07A" : "#D7B985",
            textColor: theme.color.text,
          },
          () => this.chooseDouble(value),
        );
      });
      return;
    }

    const canAct =
      this.currentPlayer === 0 && this.winner === undefined && !this.autoPlay;
    const selectedCards = this.selectedCards();
    const selectedCombo = classifyPlay(selectedCards);
    const canPass =
      canAct && Boolean(this.lastPlay && this.lastPlay.playerIndex !== 0);
    const canPlay =
      canAct &&
      Boolean(selectedCombo) &&
      (!this.lastPlay ||
        this.lastPlay.playerIndex === 0 ||
        canBeat(selectedCombo as PlayCombo, this.lastPlay.combo));

    text(this.node, "SelectedCombo", {
      x: 270,
      y: 819,
      width: 300,
      height: 56,
      text: this.autoPlay
        ? "托管中 · 自动选择合法牌"
        : selectedCards.length === 0
          ? "点选手牌"
          : selectedCombo
            ? `已选 ${selectedCards.length} 张 · ${comboLabel(selectedCombo)}`
            : `已选 ${selectedCards.length} 张 · 牌型不支持`,
      fontSize: 15,
      color: selectedCombo ? theme.color.accent : theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });
    button(
      this.node,
      "HintPlay",
      "提示",
      {
        x: 600,
        y: 819,
        width: 190,
        height: 56,
        radius: 18,
        color: "#365482",
        stroke: "#789DCE",
        textColor: theme.color.text,
        enabled: canAct,
      },
      () => this.hint(),
    );
    const passButton = button(
      this.node,
      "PassPlay",
      "不出",
      {
        x: 812,
        y: 819,
        width: 190,
        height: 56,
        radius: 18,
        color: "#53607A",
        stroke: "#8999B7",
        textColor: theme.color.text,
        enabled: true,
      },
      () => this.pass(),
    );
    const passComponent = passButton.getComponent(Button);
    if (passComponent) passComponent.interactable = canPass;
    const submitButton = button(
      this.node,
      "SubmitPlay",
      "出牌",
      {
        x: 1024,
        y: 819,
        width: 300,
        height: 56,
        radius: 18,
        color: "#DB8A26",
        stroke: "#FFE49A",
        enabled: true,
      },
      () => this.playSelected(),
    );
    const submitComponent = submitButton.getComponent(Button);
    if (submitComponent) submitComponent.interactable = canPlay;
    button(
      this.node,
      "ToggleAutoPlay",
      this.autoPlay ? "取消托管" : "开启托管",
      {
        x: 1350,
        y: 819,
        width: 190,
        height: 56,
        radius: 18,
        color: this.autoPlay ? "#2E9B83" : "#6D2B2F",
        stroke: this.autoPlay ? "#89E5D0" : "#C97B55",
        textColor: this.autoPlay ? theme.color.background : theme.color.text,
        enabled: this.winner === undefined,
      },
      () => this.toggleAutoPlay(),
    );
  }

  private renderResult(): void {
    const winner = this.winner ?? 0;
    const landlord = this.landlordIndex ?? 0;
    const landlordWon = winner === landlord;
    const localWon = landlord === 0 ? landlordWon : !landlordWon;
    panel(this.node, "ResultOverlay", {
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
      color: "#021010",
      alpha: 226,
    });
    panel(this.node, "ResultModal", {
      x: 500,
      y: 174,
      width: 600,
      height: 548,
      radius: 28,
      color: theme.color.surface,
      stroke: localWon ? theme.color.primary : theme.color.outline,
      strokeWidth: 3,
    });
    text(this.node, "ResultEyebrow", {
      x: 550,
      y: 216,
      width: 500,
      height: 32,
      text: "快速试玩 · 本局结算",
      fontSize: 16,
      color: theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });
    text(this.node, "ResultTitle", {
      x: 550,
      y: 258,
      width: 500,
      height: 70,
      text: localWon ? "本局胜利！" : "本局惜败",
      fontSize: 42,
      bold: true,
      color: localWon ? theme.color.primary : theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });
    text(this.node, "ResultBody", {
      x: 560,
      y: 350,
      width: 480,
      height: 116,
      text:
        `${playerNames[winner]}率先出完手牌，${landlordWon ? "地主" : "农民"}阵营获胜。\n` +
        `底分 1 × 本局倍数 ${this.multiplier} = ${this.multiplier} 分`,
      fontSize: 20,
      lineHeight: 36,
      color: theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });
    button(
      this.node,
      "ResultAgain",
      "再来一局",
      {
        x: 560,
        y: 510,
        width: 480,
        height: 66,
        radius: 18,
      },
      () => this.startNewMatch(),
    );
    button(
      this.node,
      "ResultLobby",
      "返回大厅",
      {
        x: 560,
        y: 598,
        width: 480,
        height: 62,
        radius: 18,
        color: theme.color.surfaceRaised,
        textColor: theme.color.text,
      },
      () => this.leavePlaytest(),
    );
  }

  private refresh(): void {
    this.render();
  }

  private refreshOpponents(): void {
    for (const playerIndex of [1, 2] as const) {
      const active =
        this.currentPlayer === playerIndex && this.winner === undefined;
      this.updateLabel(
        `OpponentCount-${playerIndex}`,
        `剩余 ${this.hands[playerIndex].length} 张`,
        active ? theme.color.primary : theme.color.textMuted,
      );
    }
  }

  private refreshTable(): void {
    const activeName = playerNames[this.currentPlayer];
    this.updateLabel(
      "TurnText",
      this.winner === undefined
        ? this.currentPlayer === 0 && this.autoPlay
          ? "我正在托管…"
          : `${activeName}${this.currentPlayer === 0 ? "的回合" : "正在思考…"}`
        : "本局已结束",
      this.currentPlayer === 0 ? theme.color.primary : theme.color.accent,
    );

    const playSignature = this.playSignature();
    if (playSignature !== this.renderedPlaySignature) {
      const previousLayer = this.node.getChildByName("TablePlayLayer");
      if (previousLayer) previousLayer.name = "RetiringTablePlayLayer";
      const playLayer = new Node("TablePlayLayer");
      this.node.addChild(playLayer);
      this.renderTablePlay(playLayer);
      previousLayer?.destroy();
      this.renderedPlaySignature = playSignature;
    }
    this.updateLabel("PlayStatus", this.statusMessage, theme.color.accent);
  }

  private playSignature(): string {
    if (!this.lastPlay) return "free";
    return `${this.lastPlay.playerIndex}:${this.lastPlay.cards
      .map((card) => card.id)
      .join(",")}`;
  }

  private refreshHand(): void {
    const hand = this.hands[0];
    const active =
      this.phase === "playing" &&
      this.currentPlayer === 0 &&
      this.winner === undefined &&
      !this.autoPlay;
    this.updateLabel(
      "MyHandTitle",
      `我的手牌 · ${this.landlordIndex === 0 ? "地主" : "农民"} · ${hand.length} 张`,
      active ? theme.color.primary : theme.color.textMuted,
    );

    const handIds = new Set(hand.map((card) => card.id));
    for (const child of [...this.node.children]) {
      if (
        child.name.startsWith("HandCard-") &&
        !handIds.has(child.name.slice("HandCard-".length))
      ) {
        child.destroy();
      }
    }

    const totalWidth =
      handCardWidth + Math.max(0, hand.length - 1) * handCardStep;
    const startX = 800 - totalWidth / 2;
    hand.forEach((card, index) => {
      const x = startX + index * handCardStep;
      const selected = this.selectedIds.has(card.id);
      const cardNode = this.node.getChildByName(`HandCard-${card.id}`);
      if (!cardNode) {
        this.renderHandCard(card, x, active);
        return;
      }
      cardNode.setPosition(x, selected ? -566 : -590);
      const cardButton = cardNode.getComponent(Button);
      if (cardButton) cardButton.interactable = active;
    });
  }

  private refreshActions(): void {
    const canAct =
      this.currentPlayer === 0 && this.winner === undefined && !this.autoPlay;
    const selectedCards = this.selectedCards();
    const selectedCombo = classifyPlay(selectedCards);
    const canPass =
      canAct && Boolean(this.lastPlay && this.lastPlay.playerIndex !== 0);
    const canPlay =
      canAct &&
      Boolean(selectedCombo) &&
      (!this.lastPlay ||
        this.lastPlay.playerIndex === 0 ||
        canBeat(selectedCombo as PlayCombo, this.lastPlay.combo));

    this.updateLabel(
      "SelectedCombo",
      this.autoPlay
        ? "托管中 · 自动选择合法牌"
        : selectedCards.length === 0
          ? "点选手牌"
          : selectedCombo
            ? `已选 ${selectedCards.length} 张 · ${comboLabel(selectedCombo)}`
            : `已选 ${selectedCards.length} 张 · 牌型不支持`,
      selectedCombo ? theme.color.accent : theme.color.textMuted,
    );
    this.updateButton("HintPlay", canAct);
    this.updateButton("PassPlay", canPass);
    this.updateButton(
      "SubmitPlay",
      canPlay,
      canPlay ? theme.color.background : theme.color.textMuted,
    );
    this.updateButton(
      "ToggleAutoPlay",
      this.winner === undefined,
      this.autoPlay ? theme.color.background : theme.color.text,
      this.autoPlay ? "取消托管" : "开启托管",
    );
  }

  private updateLabel(name: string, value: string, colorHex: string): void {
    const label = this.node.getChildByName(name)?.getComponent(Label);
    if (!label) return;
    label.string = value;
    label.color = color(colorHex);
  }

  private updateButton(
    name: string,
    enabled: boolean,
    enabledTextColor: string = theme.color.text,
    labelText?: string,
  ): void {
    const node = this.node.getChildByName(name);
    if (!node) return;
    const component = node.getComponent(Button);
    if (component) component.interactable = enabled;
    const label = node.getChildByName(`${name}Label`)?.getComponent(Label);
    if (!label) return;
    if (labelText !== undefined) label.string = labelText;
    label.color = color(enabled ? enabledTextColor : theme.color.textMuted);
  }

  private renderBidBubble(playerIndex: number, x: number, y: number): void {
    const message = this.bidMessages[playerIndex];
    if (!message) return;
    panel(this.node, `BidBubble-${playerIndex}`, {
      x,
      y,
      width: 166,
      height: 38,
      radius: 19,
      color: message.includes("不") ? "#43546D" : "#B56C24",
      stroke: message.includes("不") ? "#8294AE" : "#FFE092",
      strokeWidth: 2,
    });
    text(this.node, `BidBubbleText-${playerIndex}`, {
      x,
      y,
      width: 166,
      height: 38,
      text: message,
      fontSize: 17,
      bold: true,
      color: theme.color.text,
      align: HorizontalTextAlignment.CENTER,
    });
  }

  private chooseLandlord(call: boolean): void {
    if (this.phase !== "calling" || this.callingInProgress) return;
    this.callingInProgress = true;
    this.bidMessages[0] = call ? "叫地主" : "不叫";
    this.provisionalLandlordIndex = call ? 0 : undefined;
    this.currentPlayer = 1;
    this.statusMessage = "阿木正在考虑是否叫地主…";
    this.render();
    this.scheduleCallingStep(1);
  }

  private scheduleCallingStep(playerIndex: 1 | 2): void {
    this.clearAiTimer();
    this.aiTimer = setTimeout(() => {
      this.aiTimer = undefined;
      if (this.phase !== "calling" || !this.callingInProgress) return;
      const hasCaller = this.provisionalLandlordIndex !== undefined;
      const forcedCall = playerIndex === 2 && !hasCaller;
      const call = shouldCallLandlord(
        this.hands[playerIndex],
        hasCaller,
        forcedCall,
      );
      this.bidMessages[playerIndex] = call
        ? hasCaller
          ? "抢地主"
          : "叫地主"
        : hasCaller
          ? "不抢"
          : "不叫";
      if (call) this.provisionalLandlordIndex = playerIndex;

      if (playerIndex === 1) {
        this.currentPlayer = 2;
        this.statusMessage = "小满正在考虑是否抢地主…";
        this.render();
        this.scheduleCallingStep(2);
        return;
      }

      this.currentPlayer = this.provisionalLandlordIndex ?? 0;
      this.statusMessage = "地主身份即将确定…";
      this.render();
      this.aiTimer = setTimeout(() => {
        this.aiTimer = undefined;
        if (this.phase === "calling") this.resolveLandlord();
      }, 520);
    }, 620);
  }

  private resolveLandlord(): void {
    const landlordIndex = this.provisionalLandlordIndex ?? 0;
    this.landlordIndex = landlordIndex;
    this.hands[landlordIndex].push(...this.bottomCards);
    sortCards(this.hands[landlordIndex]);
    this.phase = "doubling";
    this.callingInProgress = false;
    this.currentPlayer = 0;
    this.statusMessage =
      landlordIndex === 0
        ? "你成为地主，三张底牌已收入手牌"
        : `${playerNames[landlordIndex]}成为地主，你与队友组成农民阵营`;
    this.render();
  }

  private chooseDouble(value: number): void {
    if (this.phase !== "doubling" || this.landlordIndex === undefined) return;
    const opponentDoubles = [1, 2].filter(
      (playerIndex) => doudizhuHandPower(this.hands[playerIndex]) >= 18,
    ).length;
    this.multiplier *= value * 2 ** opponentDoubles;
    this.phase = "playing";
    this.currentPlayer = this.landlordIndex;
    this.statusMessage = `${playerNames[this.landlordIndex]}先出牌 · 本局初始倍数 ×${this.multiplier}`;
    this.render();
    this.scheduleAiTurn();
  }

  private toggleCard(card: PlaytestCard): void {
    if (
      this.phase !== "playing" ||
      this.currentPlayer !== 0 ||
      this.winner !== undefined
    )
      return;
    if (this.selectedIds.has(card.id)) this.selectedIds.delete(card.id);
    else this.selectedIds.add(card.id);
    this.refresh();
  }

  private hint(): void {
    if (this.phase !== "playing") return;
    const previous =
      this.lastPlay && this.lastPlay.playerIndex !== 0
        ? this.lastPlay.combo
        : undefined;
    const suggestion = findSuggestedPlay(this.hands[0], previous);
    this.selectedIds.clear();
    if (!suggestion) {
      this.statusMessage = "没有能压过上一手的牌，可以选择不出";
    } else {
      for (const card of suggestion) this.selectedIds.add(card.id);
      const combo = classifyPlay(suggestion);
      this.statusMessage = combo
        ? `已为你选择一手${comboLabel(combo)}`
        : "已为你选择可出的牌";
    }
    this.refresh();
  }

  private playSelected(): void {
    if (
      this.phase !== "playing" ||
      this.currentPlayer !== 0 ||
      this.winner !== undefined
    )
      return;
    const cards = this.selectedCards();
    const combo = classifyPlay(cards);
    if (!combo) {
      this.statusMessage = "当前选择不是试玩版支持的牌型";
      this.refresh();
      return;
    }
    if (
      this.lastPlay &&
      this.lastPlay.playerIndex !== 0 &&
      !canBeat(combo, this.lastPlay.combo)
    ) {
      this.statusMessage = "这一手不能压过桌面上的牌";
      this.refresh();
      return;
    }
    this.removeCards(0, cards);
    if (combo.type === "bomb" || combo.type === "rocket") this.multiplier *= 2;
    this.lastPlay = { playerIndex: 0, cards, combo };
    this.passCount = 0;
    this.selectedIds.clear();
    this.statusMessage = `你打出${comboLabel(combo)}`;
    if (this.finishIfNeeded(0)) return;
    this.currentPlayer = 1;
    this.refresh();
    this.scheduleAiTurn();
  }

  private pass(): void {
    if (
      this.phase !== "playing" ||
      this.currentPlayer !== 0 ||
      this.winner !== undefined ||
      !this.lastPlay ||
      this.lastPlay.playerIndex === 0
    ) {
      return;
    }
    this.selectedIds.clear();
    this.statusMessage = "你选择不出";
    this.advanceAfterPass(0);
  }

  private toggleAutoPlay(): void {
    if (this.phase !== "playing" || this.winner !== undefined) return;
    this.autoPlay = !this.autoPlay;
    this.selectedIds.clear();
    this.statusMessage = this.autoPlay
      ? "已开启托管，将自动选择合法牌"
      : "已取消托管，请手动选择出牌";
    this.refresh();
    this.scheduleAiTurn();
  }

  private runAiTurn(): void {
    if (
      this.phase !== "playing" ||
      this.winner !== undefined ||
      (this.currentPlayer === 0 && !this.autoPlay)
    ) {
      return;
    }
    const playerIndex = this.currentPlayer;
    const previous =
      this.lastPlay && this.lastPlay.playerIndex !== playerIndex
        ? this.lastPlay.combo
        : undefined;
    const cards = findSuggestedPlay(this.hands[playerIndex], previous, {
      playerIndex,
      previousPlayerIndex: this.lastPlay?.playerIndex,
      handCounts: this.hands.map((hand) => hand.length),
    });
    if (!cards) {
      this.statusMessage = `${automatedPlayerName(playerIndex)}选择不出`;
      this.advanceAfterPass(playerIndex);
      return;
    }
    const combo = classifyPlay(cards);
    if (!combo) {
      this.statusMessage = `${automatedPlayerName(playerIndex)}选择不出`;
      this.advanceAfterPass(playerIndex);
      return;
    }
    if (playerIndex === 0) this.selectedIds.clear();
    this.removeCards(playerIndex, cards);
    if (combo.type === "bomb" || combo.type === "rocket") this.multiplier *= 2;
    this.lastPlay = { playerIndex, cards, combo };
    this.passCount = 0;
    this.statusMessage = `${automatedPlayerName(playerIndex)}打出${comboLabel(combo)}`;
    if (this.finishIfNeeded(playerIndex)) return;
    this.currentPlayer = (playerIndex + 1) % 3;
    this.refresh();
    this.scheduleAiTurn();
  }

  private advanceAfterPass(playerIndex: number): void {
    this.passCount += 1;
    this.currentPlayer = (playerIndex + 1) % 3;
    if (this.passCount >= 2) {
      this.passCount = 0;
      this.lastPlay = undefined;
      this.statusMessage += "，新一轮重新领出";
    }
    this.refresh();
    this.scheduleAiTurn();
  }

  private finishIfNeeded(playerIndex: number): boolean {
    if (this.hands[playerIndex].length > 0) return false;
    this.winner = playerIndex;
    this.phase = "finished";
    this.clearAiTimer();
    this.refresh();
    return true;
  }

  private selectedCards(): PlaytestCard[] {
    return sortCards(
      this.hands[0].filter((card) => this.selectedIds.has(card.id)),
    );
  }

  private removeCards(
    playerIndex: number,
    cards: readonly PlaytestCard[],
  ): void {
    const ids = new Set(cards.map((card) => card.id));
    this.hands[playerIndex] = this.hands[playerIndex].filter(
      (card) => !ids.has(card.id),
    );
  }

  private scheduleAiTurn(): void {
    this.clearAiTimer();
    if (
      this.phase !== "playing" ||
      this.winner !== undefined ||
      (this.currentPlayer === 0 && !this.autoPlay)
    ) {
      return;
    }
    this.aiTimer = setTimeout(() => {
      this.aiTimer = undefined;
      if (this.node.activeInHierarchy) this.runAiTurn();
    }, 520);
  }

  private clearAiTimer(): void {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.aiTimer = undefined;
  }

  private leavePlaytest(): void {
    this.clearAiTimer();
    this.exitAction();
  }
}

function cardText(card: PlaytestCard): string {
  return card.suit === "joker"
    ? card.rankLabel
    : `${card.rankLabel}\n${card.suitLabel}`;
}

function isRed(card: PlaytestCard): boolean {
  return card.suit === "heart" || card.suit === "diamond" || card.rank === 17;
}

function automatedPlayerName(playerIndex: number): string {
  return playerIndex === 0 ? "我（托管）" : playerNames[playerIndex];
}
