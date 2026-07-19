import {
  _decorator,
  Component,
  HorizontalTextAlignment,
  Node,
  UIOpacity,
  Vec3,
  tween,
} from "cc";

import { theme } from "../../core/theme/Theme";
import {
  mahjongTile,
  mahjongTileBack,
  playerPlate,
  tableBackdrop,
} from "../../ui/GameTableUi";
import { button, clearChildren, panel, place, text } from "../../ui/UiKit";
import {
  availableSelfActions,
  chooseMahjongDiscard,
  chooseMahjongResponse,
  createGuizhouMahjongState,
  discardMahjongTile,
  mahjongActionPlacements,
  mahjongKindLabel,
  mahjongDiscardPlacements,
  pendingResponseActions,
  performMahjongSelfAction,
  respondToMahjongDiscard,
  type GuizhouMahjongState,
  type MahjongResponseAction,
  type MahjongMeld,
  type MahjongTile,
} from "./GuizhouMahjongPlaytestModel";

const { ccclass } = _decorator;
const playerPortraits = [
  "ui/characters/portrait-linxi",
  "ui/characters/portrait-ace",
  "ui/characters/portrait-xiaoman",
  "ui/characters/portrait-laozhou",
] as const;

@ccclass("GuizhouMahjongPlaytestView")
export class GuizhouMahjongPlaytestView extends Component {
  private state?: GuizhouMahjongState;
  private selectedTileId?: string;
  private aiTimer?: ReturnType<typeof setTimeout>;
  private openingAnimationPending = false;
  private readonly renderedDiscardIds = new Set<string>();
  private previousActivePlayerIndex?: number;
  private skippedSelfActionKey?: string;
  private exitAction: () => void = () => undefined;

  configure(exitAction: () => void): void {
    this.exitAction = exitAction;
  }

  startNewMatch(): void {
    this.clearAiTimer();
    this.state = createGuizhouMahjongState();
    this.selectedTileId = undefined;
    this.openingAnimationPending = true;
    this.renderedDiscardIds.clear();
    this.previousActivePlayerIndex = undefined;
    this.skippedSelfActionKey = undefined;
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
    const animateOpening = this.openingAnimationPending;
    this.openingAnimationPending = false;
    clearChildren(this.node);
    tableBackdrop(
      this.node,
      "MahjongBackground",
      "ui/table-backgrounds/mahjong-table",
      "#0C6056",
    );
    panel(this.node, "MahjongTopShade", {
      x: 0,
      y: 0,
      width: 1600,
      height: 74,
      color: "#071B1A",
      alpha: 218,
    });
    this.renderTopBar(state);
    this.renderWall(state);
    this.renderOpponents(state);
    this.renderCenter(state);
    this.renderHand(state, animateOpening);
    this.renderMelds(state, 0);
    this.renderActions(state);
    if (state.phase === "finished") this.renderResult(state);
  }

  private renderTopBar(state: GuizhouMahjongState): void {
    panel(this.node, "MahjongTopBar", {
      x: 18,
      y: 12,
      width: 1564,
      height: 54,
      radius: 27,
      color: "#102321",
      alpha: 242,
      stroke: "#A76536",
    });
    button(
      this.node,
      "MahjongBack",
      "‹  大厅",
      {
        x: 32,
        y: 18,
        width: 132,
        height: 42,
        radius: 18,
        color: "#217166",
        stroke: "#E6D391",
        textColor: theme.color.text,
      },
      () => this.leave(),
    );
    text(this.node, "MahjongTitle", {
      x: 190,
      y: 16,
      width: 650,
      height: 44,
      text: "贵州麻将  ·  经典好友局",
      fontSize: 26,
      bold: true,
      color: "#FFF6D5",
    });
    text(this.node, "MahjongRules", {
      x: 760,
      y: 16,
      width: 620,
      height: 44,
      text: `不吃 · 可碰杠 · 自摸/点炮    牌墙 ${state.wall.length}`,
      fontSize: 16,
      color: "#D7EDE0",
      align: HorizontalTextAlignment.RIGHT,
    });
    button(
      this.node,
      "MahjongSound",
      "♫",
      {
        x: 1400,
        y: 18,
        width: 72,
        height: 42,
        radius: 18,
        color: "#217166",
        stroke: "#E6D391",
        textColor: theme.color.text,
      },
      () => undefined,
    );
    button(
      this.node,
      "MahjongMenu",
      "☰",
      {
        x: 1482,
        y: 18,
        width: 80,
        height: 42,
        radius: 18,
        color: "#217166",
        stroke: "#E6D391",
        textColor: theme.color.text,
      },
      () => undefined,
    );
  }

  private renderWall(state: GuizhouMahjongState): void {
    const stacks = Math.max(8, Math.min(18, Math.ceil(state.wall.length / 4)));
    const topStep = 32;
    const topStart = 800 - (stacks * topStep) / 2;
    for (let index = 0; index < stacks; index += 1) {
      mahjongTileBack(this.node, `WallTop-${index}`, {
        x: topStart + index * topStep,
        y: 136,
        width: 30,
        height: 38,
      });
      mahjongTileBack(this.node, `WallBottom-${index}`, {
        x: topStart + index * topStep,
        y: 666,
        width: 30,
        height: 34,
      });
    }
    const sideStacks = Math.max(6, Math.min(12, Math.ceil(stacks * 0.66)));
    const sideStart = 410 - (sideStacks * 27) / 2;
    for (let index = 0; index < sideStacks; index += 1) {
      const y = sideStart + index * 27;
      mahjongTileBack(this.node, `WallLeft-${index}`, {
        x: 160,
        y,
        width: 38,
        height: 25,
      });
      mahjongTileBack(this.node, `WallRight-${index}`, {
        x: 1402,
        y,
        width: 38,
        height: 25,
      });
    }
  }

  private renderOpponents(state: GuizhouMahjongState): void {
    const positions = [
      { x: 12, y: 366, width: 190, avatar: "西" },
      { x: 705, y: 76, width: 190, avatar: "北" },
      { x: 1398, y: 366, width: 190, avatar: "东" },
    ] as const;
    [1, 2, 3].forEach((playerIndex, positionIndex) => {
      const player = state.players[playerIndex];
      const position = positions[positionIndex];
      if (!player || !position) return;
      const active =
        state.phase !== "finished" && state.currentPlayerIndex === playerIndex;
      playerPlate(this.node, `MahjongPlayer-${playerIndex}`, {
        x: position.x,
        y: position.y,
        width: position.width,
        height: 82,
        avatar: position.avatar,
        avatarResourcePath: playerPortraits[playerIndex],
        name: player.name,
        detail: `${player.hand.length} 张 · 副露 ${player.melds.length}\n${active ? "● 正在出牌" : `弃牌 ${player.discards.length}`}`,
        active,
        dealer: playerIndex === state.dealerIndex,
        accent: ["#3B8C76", "#4F7C9E", "#84649A", "#3B8C76"][playerIndex],
      });
      this.renderOpponentHandBacks(
        playerIndex,
        player.hand.length,
        player.melds,
      );
      this.renderMelds(state, playerIndex);
    });
  }

  private renderOpponentHandBacks(
    playerIndex: number,
    handCount: number,
    melds: readonly MahjongMeld[],
  ): void {
    const visibleCount = Math.min(14, handCount);
    const meldSpan = this.meldTrackLength(melds);
    const trackGap = meldSpan > 0 && visibleCount > 0 ? 18 : 0;
    const topHandSpan = visibleCount > 0 ? 34 + (visibleCount - 1) * 34 : 0;
    const sideHandSpan = visibleCount > 0 ? 34 + (visibleCount - 1) * 29 : 0;
    for (let index = 0; index < visibleCount; index += 1) {
      const horizontal = playerIndex === 2;
      const total =
        (horizontal ? topHandSpan : sideHandSpan) + meldSpan + trackGap;
      const trackStart = (horizontal ? 800 : 430) - total / 2;
      const x = horizontal
        ? trackStart + meldSpan + trackGap + index * 34
        : playerIndex === 1
          ? 244
          : 1322;
      const handStartY =
        playerIndex === 3 ? trackStart + meldSpan + trackGap : trackStart;
      const y = horizontal ? 126 : handStartY + index * 29;
      this.renderTileBack(
        `MahjongHandBack-${playerIndex}-${index}`,
        x,
        y,
        34,
        48,
        playerIndex === 2 ? 180 : playerIndex === 1 ? 90 : -90,
      );
    }
  }

  private renderMelds(state: GuizhouMahjongState, playerIndex: number): void {
    const player = state.players[playerIndex];
    if (!player || player.melds.length === 0) return;
    player.melds
      .slice(0, 4)
      .forEach((meld, index) =>
        this.renderMeld(state, playerIndex, meld, index),
      );
  }

  private renderMeld(
    state: GuizhouMahjongState,
    playerIndex: number,
    meld: MahjongMeld,
    meldIndex: number,
  ): void {
    const player = state.players[playerIndex];
    if (!player) return;
    const tileCount = meld.type === "gang" ? 4 : 3;
    const meldSpan = this.meldTrackLength(player.melds);
    const offset = this.meldTrackOffset(player.melds, meldIndex);
    const handCount = Math.min(14, player.hand.length);
    const topHandSpan = handCount > 0 ? 34 + (handCount - 1) * 34 : 0;
    const sideHandSpan = handCount > 0 ? 34 + (handCount - 1) * 29 : 0;
    const trackGap = meldSpan > 0 && handCount > 0 ? 18 : 0;
    const localLayout = this.localHandLayout(state);
    const origins = [
      {
        x: localLayout.meldStartX + offset,
        y: 742,
        angle: 0,
        vertical: false,
      },
      {
        x: 244,
        y:
          430 -
          (sideHandSpan + trackGap + meldSpan) / 2 +
          sideHandSpan +
          trackGap +
          offset,
        angle: 90,
        vertical: true,
      },
      {
        x: 800 - (topHandSpan + trackGap + meldSpan) / 2 + offset,
        y: 126,
        angle: 180,
        vertical: false,
      },
      {
        x: 1322,
        y: 430 - (sideHandSpan + trackGap + meldSpan) / 2 + offset,
        angle: -90,
        vertical: true,
      },
    ] as const;
    const origin = origins[playerIndex];
    if (!origin) return;
    const tile = this.tileForKind(
      meld.kind,
      `meld-${playerIndex}-${meldIndex}`,
    );
    for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
      this.renderTile(
        `Meld-${playerIndex}-${meldIndex}-${tileIndex}`,
        tile,
        origin.x + (origin.vertical ? 0 : tileIndex * 38),
        origin.y + (origin.vertical ? tileIndex * 38 : 0),
        40,
        56,
        false,
        undefined,
        origin.angle,
      );
    }
  }

  private meldTrackLength(melds: readonly MahjongMeld[]): number {
    return melds.slice(0, 4).reduce((length, meld, index) => {
      const tileCount = meld.type === "gang" ? 4 : 3;
      const groupSpan = 40 + (tileCount - 1) * 38;
      return length + groupSpan + (index > 0 ? 14 : 0);
    }, 0);
  }

  private meldTrackOffset(
    melds: readonly MahjongMeld[],
    meldIndex: number,
  ): number {
    return melds.slice(0, meldIndex).reduce((offset, meld) => {
      const tileCount = meld.type === "gang" ? 4 : 3;
      return offset + 40 + (tileCount - 1) * 38 + 14;
    }, 0);
  }

  private renderCenter(state: GuizhouMahjongState): void {
    if (
      state.phase !== "finished" &&
      this.previousActivePlayerIndex !== state.currentPlayerIndex
    ) {
      const turnPulse = panel(this.node, "MahjongTurnPulse", {
        x: 704,
        y: 344,
        width: 192,
        height: 150,
        radius: 22,
        color: "#8DCE39",
        alpha: 88,
        stroke: "#DFFF80",
        strokeWidth: 3,
      });
      this.fadeOut(turnPulse, 0.52);
    }
    this.previousActivePlayerIndex = state.currentPlayerIndex;
    panel(this.node, "MahjongWallCounter", {
      x: 208,
      y: 112,
      width: 112,
      height: 48,
      radius: 8,
      color: "#071B19",
      alpha: 224,
      stroke: "#3CA66C",
    });
    text(this.node, "MahjongWallCounterText", {
      x: 208,
      y: 112,
      width: 112,
      height: 48,
      text: `余 ${state.wall.length}`,
      fontSize: 21,
      bold: true,
      color: "#F4F4E8",
      align: HorizontalTextAlignment.CENTER,
    });
    panel(this.node, "MahjongCompass", {
      x: 716,
      y: 350,
      width: 168,
      height: 136,
      radius: 20,
      color: "#20292A",
      alpha: 250,
      stroke: "#111718",
      strokeWidth: 7,
    });
    panel(this.node, "MahjongCompassScreen", {
      x: 756,
      y: 386,
      width: 88,
      height: 58,
      radius: 10,
      color: "#051619",
      stroke: "#2B6065",
      strokeWidth: 3,
    });
    text(this.node, "MahjongCompassDigits", {
      x: 756,
      y: 386,
      width: 88,
      height: 58,
      text: String(state.wall.length).padStart(2, "0").slice(-2),
      fontSize: 38,
      bold: true,
      color: "#27D9FF",
      align: HorizontalTextAlignment.CENTER,
    });
    const windSlots = [
      { label: "南", x: 765, y: 448, width: 70, height: 32 },
      { label: "西", x: 720, y: 394, width: 34, height: 42 },
      { label: "北", x: 765, y: 354, width: 70, height: 28 },
      { label: "东", x: 846, y: 394, width: 34, height: 42 },
    ] as const;
    windSlots.forEach((slot, playerIndex) => {
      const active = state.currentPlayerIndex === playerIndex;
      if (active) {
        panel(this.node, `MahjongWindActive-${playerIndex}`, {
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height,
          radius: 9,
          color: "#6BAE25",
          stroke: "#B9E85A",
          strokeWidth: 2,
        });
      }
      text(this.node, `MahjongWind-${playerIndex}`, {
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        text: slot.label,
        fontSize: 19,
        bold: true,
        color: active ? "#FFF4BE" : "#B8C2C0",
        align: HorizontalTextAlignment.CENTER,
      });
    });
    text(this.node, "MahjongMessage", {
      x: 690,
      y: 474,
      width: 220,
      height: 38,
      text: state.message,
      fontSize: 13,
      lineHeight: 20,
      color: "#F5E9BE",
      align: HorizontalTextAlignment.CENTER,
    });
    state.players.forEach((player, playerIndex) => {
      const recent = player.discards.slice(-18);
      const placements = mahjongDiscardPlacements(playerIndex, recent.length);
      recent.forEach((tile, index) => {
        const placement = placements[index];
        if (!placement) return;
        const tileNode = this.renderTile(
          `Discard-${playerIndex}-${index}`,
          tile,
          placement.x,
          placement.y,
          placement.width,
          placement.height,
          false,
          undefined,
          placement.angle,
        );
        if (!this.renderedDiscardIds.has(tile.id)) {
          this.animateTileEntry(tileNode, 34, 0.72);
          this.renderedDiscardIds.add(tile.id);
        }
      });
    });
  }

  private renderHand(
    state: GuizhouMahjongState,
    animateOpening: boolean,
  ): void {
    const player = state.players[0];
    if (!player) return;
    const active = state.phase === "discard" && state.currentPlayerIndex === 0;
    playerPlate(this.node, "MahjongLocalPlayer", {
      x: 16,
      y: 798,
      width: 196,
      height: 86,
      avatar: "我",
      avatarResourcePath: playerPortraits[0],
      name: "林溪（我）",
      detail: `庄家 · ${player.hand.length} 张\n${active ? "● 请出牌" : `副露 ${player.melds.length}`}`,
      active,
      dealer: state.dealerIndex === 0,
      accent: "#2C7A69",
    });
    text(this.node, "MahjongHandTitle", {
      x: 232,
      y: 694,
      width: 1120,
      height: 28,
      text: active
        ? `${this.selectedTileId ? "再次点击已选牌打出" : "请选择要打出的牌"} · ${player.hand.length} 张`
        : `我的手牌 · ${player.hand.length} 张 · ${player.melds.map((meld) => `${meld.type === "gang" ? "杠" : "碰"}${mahjongKindLabel(meld.kind)}`).join("  ") || "门清"}`,
      fontSize: 16,
      bold: true,
      color: active ? theme.color.primary : theme.color.textMuted,
      align: HorizontalTextAlignment.CENTER,
    });
    const layout = this.localHandLayout(state);
    const { arrangedTiles, drawnTile, tileWidth, tileHeight, step, startX } =
      layout;
    arrangedTiles.forEach((tile, index) => {
      const selected = tile.id === this.selectedTileId;
      const tileNode = this.renderTile(
        `HandTile-${tile.id}`,
        tile,
        startX + index * step,
        selected ? 718 : 742,
        tileWidth,
        tileHeight,
        active,
        () => this.selectOrDiscard(tile.id),
      );
      if (animateOpening) {
        this.animateTileEntry(tileNode, -48, 0.82, index * 0.035);
      }
    });
    if (drawnTile) {
      const selected = drawnTile.id === this.selectedTileId;
      const drawnX = startX + arrangedTiles.length * step + layout.drawnGap;
      const tileNode = this.renderTile(
        `DrawnTile-${drawnTile.id}`,
        drawnTile,
        drawnX,
        selected ? 718 : 742,
        tileWidth,
        tileHeight,
        active,
        () => this.selectOrDiscard(drawnTile.id),
      );
      text(this.node, "MahjongDrawnTileLabel", {
        x: drawnX - 3,
        y: 710,
        width: tileWidth + 6,
        height: 24,
        text: "摸牌",
        fontSize: 12,
        bold: true,
        color: "#FFE489",
        align: HorizontalTextAlignment.CENTER,
      });
      if (animateOpening) this.animateTileEntry(tileNode, -48, 0.82, 0.48);
    }
  }

  private localHandLayout(state: GuizhouMahjongState): {
    arrangedTiles: MahjongTile[];
    drawnTile?: MahjongTile;
    tileWidth: number;
    tileHeight: number;
    step: number;
    drawnGap: number;
    startX: number;
    meldStartX: number;
  } {
    const player = state.players[0];
    const hand = player?.hand ?? [];
    const drawnTile = hand.find((tile) => tile.id === state.drawnTileId);
    const arrangedTiles = drawnTile
      ? hand.filter((tile) => tile.id !== drawnTile.id)
      : hand;
    const count = Math.max(1, hand.length);
    const gap = count > 16 ? 2 : 4;
    const tileWidth = Math.max(
      46,
      Math.min(68, Math.floor((1080 - gap * (count - 1)) / count)),
    );
    const tileHeight = Math.round(tileWidth * 1.42);
    const step = tileWidth + gap;
    const drawnGap = drawnTile ? Math.max(22, Math.round(tileWidth * 0.42)) : 0;
    const handSpan = tileWidth + Math.max(0, hand.length - 1) * step + drawnGap;
    const meldSpan = this.meldTrackLength(player?.melds ?? []);
    const trackGap = meldSpan > 0 && hand.length > 0 ? 26 : 0;
    const startX = 800 - (handSpan + trackGap + meldSpan) / 2;
    return {
      arrangedTiles,
      drawnTile,
      tileWidth,
      tileHeight,
      step,
      drawnGap,
      startX,
      meldStartX: startX + handSpan + trackGap,
    };
  }

  private renderTile(
    name: string,
    tile: MahjongTile,
    x: number,
    y: number,
    width: number,
    height: number,
    enabled: boolean,
    onClick?: () => void,
    angle = 0,
  ): Node {
    const tileGroup = new Node(`${name}Group`);
    this.node.addChild(tileGroup);
    const transform = place(tileGroup, { x, y, width, height });
    transform.setAnchorPoint(0.5, 0.5);
    tileGroup.setPosition(x + width / 2, -(y + height / 2));
    tileGroup.angle = angle;
    mahjongTile(tileGroup, name, {
      x: -width / 2,
      y: -height / 2,
      width,
      height,
      radius: width > 58 ? 9 : 6,
      label: tile.label,
      rank: tile.rank,
      suit: tile.suit,
      foreground:
        tile.suit === "wan"
          ? "#B73731"
          : tile.suit === "tong"
            ? "#245A91"
            : "#23734D",
      selected: tile.id === this.selectedTileId,
      enabled,
      onClick,
    });
    return tileGroup;
  }

  private renderTileBack(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    angle: number,
  ): void {
    const tileGroup = new Node(`${name}Group`);
    this.node.addChild(tileGroup);
    const transform = place(tileGroup, { x, y, width, height });
    transform.setAnchorPoint(0.5, 0.5);
    tileGroup.setPosition(x + width / 2, -(y + height / 2));
    tileGroup.angle = angle;
    mahjongTileBack(tileGroup, name, {
      x: -width / 2,
      y: -height / 2,
      width,
      height,
    });
  }

  private tileForKind(kind: number, id: string): MahjongTile {
    const rank = (kind % 9) + 1;
    const suit = kind < 9 ? "wan" : kind < 18 ? "tong" : "tiao";
    return { id, kind, rank, suit, label: mahjongKindLabel(kind) };
  }

  private renderActions(state: GuizhouMahjongState): void {
    if (state.phase === "finished") {
      text(this.node, "MahjongResult", {
        x: 390,
        y: 812,
        width: 600,
        height: 62,
        text: state.message,
        fontSize: 23,
        bold: true,
        color: theme.color.accent,
        align: HorizontalTextAlignment.CENTER,
      });
      button(
        this.node,
        "MahjongAgain",
        "再来一局",
        {
          x: 1050,
          y: 808,
          width: 270,
          height: 66,
          radius: 33,
          color: "#E6A62D",
          stroke: "#FFE78F",
        },
        () => this.startNewMatch(),
      );
      return;
    }
    const responses = pendingResponseActions(state, 0);
    if (responses.length > 0) {
      const definitions = (
        [
          ["peng", "碰"],
          ["gang", "杠"],
          ["hu", "胡"],
          ["pass", "过"],
        ] as const
      ).filter(([action]) => responses.includes(action));
      const placements = mahjongActionPlacements(
        definitions.map(([action]) => action),
      );
      definitions.forEach(([action, label], index) => {
        const placement = placements[index];
        if (!placement) return;
        button(
          this.node,
          `MahjongResponse-${action}`,
          label,
          {
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            radius: placement.width / 2,
            color:
              action === "pass"
                ? "#27939B"
                : action === "hu"
                  ? "#D94A2D"
                  : "#E4A52C",
            stroke: "#FFF0A0",
            strokeWidth: 3,
            textColor: "#FFF8D5",
          },
          () => this.respond(action),
        );
      });
      return;
    }
    const self = availableSelfActions(state, 0);
    if (state.phase !== "discard" || state.currentPlayerIndex !== 0) return;
    const selfActionKey = this.selfActionKey(state);
    if (this.skippedSelfActionKey === selfActionKey) return;
    const selfDefinitions: [MahjongResponseAction, string][] = [];
    if (self.gangKinds.length > 0) selfDefinitions.push(["gang", "杠"]);
    if (self.canHu) selfDefinitions.push(["hu", "胡"]);
    if (selfDefinitions.length === 0) return;
    selfDefinitions.push(["pass", "过"]);
    const placements = mahjongActionPlacements(
      selfDefinitions.map(([action]) => action),
    );
    selfDefinitions.forEach(([action, label], index) => {
      const placement = placements[index];
      if (!placement) return;
      button(
        this.node,
        `MahjongSelf-${action}`,
        label,
        {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          radius: placement.width / 2,
          color:
            action === "pass"
              ? "#27939B"
              : action === "hu"
                ? "#D94A2D"
                : "#E4A52C",
          stroke: "#FFF0A0",
          strokeWidth: 3,
          textColor: "#FFF8D5",
        },
        () => {
          if (action === "gang") this.selfGang();
          else if (action === "hu") this.selfHu();
          else {
            this.skippedSelfActionKey = selfActionKey;
            this.render();
          }
        },
      );
    });
  }

  private renderResult(state: GuizhouMahjongState): void {
    const localWon = state.winners.includes(0);
    const draw = state.winners.length === 0;
    const winnerNames = state.winners
      .map((index) => state.players[index]?.name)
      .filter(Boolean)
      .join("、");
    panel(this.node, "MahjongResultOverlay", {
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
      color: "#021B18",
      alpha: 224,
    });
    panel(this.node, "MahjongResultModal", {
      x: 480,
      y: 152,
      width: 640,
      height: 586,
      radius: 30,
      color: "#0B4B43",
      stroke: localWon ? "#F4D178" : "#74A997",
      strokeWidth: 3,
    });
    text(this.node, "MahjongResultEyebrow", {
      x: 540,
      y: 196,
      width: 520,
      height: 32,
      text: "贵州麻将 · 本局结算",
      fontSize: 16,
      color: "#B9D8CC",
      align: HorizontalTextAlignment.CENTER,
    });
    text(this.node, "MahjongResultTitle", {
      x: 540,
      y: 240,
      width: 520,
      height: 72,
      text: draw ? "本局流局" : localWon ? "胡牌！" : "本局惜败",
      fontSize: 44,
      bold: true,
      color: localWon ? "#FFE28A" : "#D7EDE0",
      align: HorizontalTextAlignment.CENTER,
    });
    text(this.node, "MahjongResultBody", {
      x: 550,
      y: 334,
      width: 500,
      height: 132,
      text: draw
        ? `牌墙已摸完 · 共 ${state.turn} 巡\n本局无人胡牌，不计分`
        : `${winnerNames || "玩家"}${state.winType === "zimo" ? "自摸" : "点炮胡牌"}\n底分 1 · ${state.winType === "zimo" ? "三家结算" : "放铳结算"}`,
      fontSize: 20,
      lineHeight: 38,
      color: "#D7EDE0",
      align: HorizontalTextAlignment.CENTER,
    });
    button(
      this.node,
      "MahjongResultAgain",
      "再来一局",
      {
        x: 550,
        y: 524,
        width: 500,
        height: 66,
        radius: 20,
        color: "#D8A842",
        stroke: "#FFE6A3",
      },
      () => this.startNewMatch(),
    );
    button(
      this.node,
      "MahjongResultLobby",
      "返回大厅",
      {
        x: 550,
        y: 612,
        width: 500,
        height: 62,
        radius: 20,
        color: "#236B60",
        stroke: "#8FC3B0",
        textColor: theme.color.text,
      },
      () => this.leave(),
    );
  }

  private animateTileEntry(
    node: Node,
    offsetY: number,
    startScale: number,
    delay = 0,
  ): void {
    const target = new Vec3(node.position.x, node.position.y, node.position.z);
    const opacity = node.addComponent(UIOpacity);
    opacity.opacity = 0;
    node.setPosition(target.x, target.y + offsetY, target.z);
    node.setScale(new Vec3(startScale, startScale, 1));
    tween(node)
      .delay(delay)
      .to(
        0.24,
        { position: target, scale: new Vec3(1, 1, 1) },
        { easing: "backOut" },
      )
      .start();
    tween(opacity)
      .delay(delay)
      .to(0.16, { opacity: 255 }, { easing: "quadOut" })
      .start();
  }

  private fadeOut(node: Node, duration: number): void {
    const opacity = node.addComponent(UIOpacity);
    opacity.opacity = 255;
    tween(opacity)
      .to(duration, { opacity: 0 }, { easing: "quadOut" })
      .call(() => {
        if (node.isValid) node.destroy();
      })
      .start();
  }

  private selectOrDiscard(tileId: string): void {
    if (!this.state) return;
    if (this.selectedTileId !== tileId) {
      this.selectedTileId = tileId;
      this.render();
      return;
    }
    discardMahjongTile(this.state, 0, tileId);
    this.selectedTileId = undefined;
    this.skippedSelfActionKey = undefined;
    this.render();
    this.scheduleAi();
  }

  private selfActionKey(state: GuizhouMahjongState): string {
    const handIds =
      state.players[0]?.hand.map((tile) => tile.id).join(",") ?? "";
    return `${state.turn}:${state.drawnTileId ?? "claim"}:${handIds}`;
  }

  private selfHu(): void {
    if (!this.state) return;
    performMahjongSelfAction(this.state, 0, "hu");
    this.skippedSelfActionKey = undefined;
    this.render();
  }

  private selfGang(): void {
    if (!this.state) return;
    const kind = availableSelfActions(this.state, 0).gangKinds[0];
    if (kind === undefined) return;
    performMahjongSelfAction(this.state, 0, "gang", kind);
    this.selectedTileId = undefined;
    this.skippedSelfActionKey = undefined;
    this.render();
  }

  private respond(action: MahjongResponseAction): void {
    if (!this.state) return;
    respondToMahjongDiscard(this.state, 0, action);
    this.skippedSelfActionKey = undefined;
    this.render();
    this.scheduleAi();
  }

  private scheduleAi(): void {
    this.clearAiTimer();
    const state = this.state;
    if (!state || state.phase === "finished") return;
    if (pendingResponseActions(state, 0).length > 0) return;
    const pendingBot = state.response?.options.find(
      (option) =>
        option.playerIndex !== 0 &&
        !state.response?.decisions.some(
          (decision) => decision.playerIndex === option.playerIndex,
        ),
    );
    if (state.phase === "discard" && state.currentPlayerIndex === 0) return;
    this.aiTimer = setTimeout(() => {
      this.aiTimer = undefined;
      if (!this.state || !this.node.activeInHierarchy) return;
      if (this.state.phase === "response" && pendingBot) {
        respondToMahjongDiscard(
          this.state,
          pendingBot.playerIndex,
          chooseMahjongResponse(this.state, pendingBot.playerIndex),
        );
      } else if (this.state.phase === "discard") {
        const actor = this.state.currentPlayerIndex;
        const self = availableSelfActions(this.state, actor);
        if (self.canHu) performMahjongSelfAction(this.state, actor, "hu");
        else if (self.gangKinds.length > 0 && this.state.wall.length > 8) {
          performMahjongSelfAction(
            this.state,
            actor,
            "gang",
            self.gangKinds[0],
          );
        } else {
          const hand = this.state.players[actor]?.hand ?? [];
          discardMahjongTile(this.state, actor, chooseMahjongDiscard(hand).id);
        }
      }
      this.render();
      this.scheduleAi();
    }, 560);
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
