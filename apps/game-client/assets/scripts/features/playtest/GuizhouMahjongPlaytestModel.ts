export type MahjongSuit = "wan" | "tong" | "tiao";
export type MahjongPhase = "discard" | "response" | "finished";
export type MahjongResponseAction = "pass" | "peng" | "gang" | "hu";

export interface MahjongTile {
  id: string;
  kind: number;
  suit: MahjongSuit;
  rank: number;
  label: string;
}

export interface MahjongMeld {
  type: "peng" | "gang";
  kind: number;
  fromPlayer?: number;
  concealed?: boolean;
}

export interface MahjongPlayer {
  id: string;
  name: string;
  hand: MahjongTile[];
  melds: MahjongMeld[];
  discards: MahjongTile[];
}

export interface MahjongResponseOption {
  playerIndex: number;
  actions: MahjongResponseAction[];
}

export interface MahjongResponseDecision {
  playerIndex: number;
  action: MahjongResponseAction;
}

export interface MahjongResponseContext {
  tile: MahjongTile;
  discarderIndex: number;
  options: MahjongResponseOption[];
  decisions: MahjongResponseDecision[];
}

export interface GuizhouMahjongState {
  players: MahjongPlayer[];
  wall: MahjongTile[];
  dealerIndex: number;
  currentPlayerIndex: number;
  phase: MahjongPhase;
  response?: MahjongResponseContext;
  winners: number[];
  winningTile?: MahjongTile;
  winType?: "zimo" | "dianpao";
  message: string;
  turn: number;
  drawnTileId?: string;
}

export interface MahjongTilePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
}

export interface MahjongActionPlacement {
  action: MahjongResponseAction;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MAHJONG_DISCARD_CAPACITY = 18;

export function createMahjongWall(): MahjongTile[] {
  const wall: MahjongTile[] = [];
  const suits: readonly { suit: MahjongSuit; suffix: string }[] = [
    { suit: "wan", suffix: "万" },
    { suit: "tong", suffix: "筒" },
    { suit: "tiao", suffix: "条" },
  ];
  for (let suitIndex = 0; suitIndex < suits.length; suitIndex += 1) {
    const suit = suits[suitIndex];
    if (!suit) continue;
    for (let rank = 1; rank <= 9; rank += 1) {
      const kind = suitIndex * 9 + rank - 1;
      for (let copy = 0; copy < 4; copy += 1) {
        wall.push({
          id: `${suit.suit}-${rank}-${copy}`,
          kind,
          suit: suit.suit,
          rank,
          label: `${rank}${suit.suffix}`,
        });
      }
    }
  }
  return wall;
}

export function createGuizhouMahjongState(
  names: readonly string[] = ["我", "阿策", "小满", "老周"],
  random: () => number = Math.random,
): GuizhouMahjongState {
  if (names.length !== 4)
    throw new Error("Guizhou Mahjong requires four players");
  const wall = shuffle(createMahjongWall(), random);
  const players: MahjongPlayer[] = names.map((name, index) => ({
    id: `player-${index}`,
    name,
    hand: [],
    melds: [],
    discards: [],
  }));
  for (let round = 0; round < 13; round += 1) {
    for (const player of players) {
      const tile = wall.pop();
      if (tile) player.hand.push(tile);
    }
  }
  for (const player of players) sortMahjongTiles(player.hand);
  const dealerTile = wall.pop();
  if (dealerTile) players[0]?.hand.push(dealerTile);
  return {
    players,
    wall,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    phase: "discard",
    winners: [],
    message: "庄家摸牌，请打出一张牌",
    turn: 1,
    drawnTileId: dealerTile?.id,
  };
}

export function discardMahjongTile(
  state: GuizhouMahjongState,
  playerIndex: number,
  tileId: string,
): void {
  if (state.phase !== "discard" || state.currentPlayerIndex !== playerIndex) {
    throw new Error("It is not this player's discard turn");
  }
  const player = state.players[playerIndex];
  const tileIndex = player?.hand.findIndex((tile) => tile.id === tileId) ?? -1;
  if (!player || tileIndex < 0) throw new Error("Tile is not in the hand");
  const [tile] = player.hand.splice(tileIndex, 1);
  if (!tile) throw new Error("Tile is missing");
  delete state.drawnTileId;
  sortMahjongTiles(player.hand);
  player.discards.push(tile);
  state.message = `${player.name}打出${tile.label}`;
  const options = buildResponseOptions(state, playerIndex, tile);
  if (options.length === 0) {
    drawForNextPlayer(state, playerIndex);
    return;
  }
  state.phase = "response";
  state.response = {
    tile,
    discarderIndex: playerIndex,
    options,
    decisions: [],
  };
}

export function availableSelfActions(
  state: GuizhouMahjongState,
  playerIndex: number,
): { canHu: boolean; gangKinds: number[] } {
  const player = state.players[playerIndex];
  if (
    state.phase !== "discard" ||
    state.currentPlayerIndex !== playerIndex ||
    !player
  ) {
    return { canHu: false, gangKinds: [] };
  }
  const counts = tileCounts(player.hand);
  const concealed = counts.flatMap((count, kind) =>
    count === 4 ? [kind] : [],
  );
  const added = player.melds.flatMap((meld) =>
    meld.type === "peng" && (counts[meld.kind] ?? 0) > 0 ? [meld.kind] : [],
  );
  return {
    canHu: isWinningMahjongHand(player.hand),
    gangKinds: [...concealed, ...added],
  };
}

export function performMahjongSelfAction(
  state: GuizhouMahjongState,
  playerIndex: number,
  action: "hu" | "gang",
  gangKind?: number,
): void {
  const available = availableSelfActions(state, playerIndex);
  const player = state.players[playerIndex];
  if (!player) throw new Error("Player is missing");
  if (action === "hu") {
    if (!available.canHu) throw new Error("Hand cannot win");
    state.phase = "finished";
    state.winners = [playerIndex];
    state.winType = "zimo";
    state.winningTile = player.hand[player.hand.length - 1];
    state.message = `${player.name}自摸胡牌`;
    return;
  }
  if (gangKind === undefined || !available.gangKinds.includes(gangKind)) {
    throw new Error("Gang is not available");
  }
  const pengMeld = player.melds.find(
    (meld) => meld.type === "peng" && meld.kind === gangKind,
  );
  if (pengMeld) {
    removeKinds(player.hand, gangKind, 1);
    pengMeld.type = "gang";
  } else {
    removeKinds(player.hand, gangKind, 4);
    player.melds.push({ type: "gang", kind: gangKind, concealed: true });
  }
  delete state.drawnTileId;
  sortMahjongTiles(player.hand);
  state.message = `${player.name}${pengMeld ? "补杠" : "暗杠"}${mahjongKindLabel(gangKind)}`;
  drawReplacement(state, playerIndex);
}

export function respondToMahjongDiscard(
  state: GuizhouMahjongState,
  playerIndex: number,
  action: MahjongResponseAction,
): void {
  const context = state.response;
  if (state.phase !== "response" || !context)
    throw new Error("No response window");
  const option = context.options.find(
    (candidate) => candidate.playerIndex === playerIndex,
  );
  if (!option || !option.actions.includes(action))
    throw new Error("Response is not available");
  if (
    context.decisions.some((decision) => decision.playerIndex === playerIndex)
  ) {
    throw new Error("Player has already responded");
  }
  context.decisions.push({ playerIndex, action });
  if (context.decisions.length === context.options.length)
    resolveResponses(state);
}

export function pendingResponseActions(
  state: GuizhouMahjongState,
  playerIndex: number,
): MahjongResponseAction[] {
  const context = state.response;
  if (state.phase !== "response" || !context) return [];
  if (
    context.decisions.some((decision) => decision.playerIndex === playerIndex)
  )
    return [];
  return (
    context.options.find((option) => option.playerIndex === playerIndex)
      ?.actions ?? []
  );
}

export function chooseMahjongDiscard(
  hand: readonly MahjongTile[],
): MahjongTile {
  if (hand.length === 0) throw new Error("Cannot discard from an empty hand");
  let best = hand[0] as MahjongTile;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const tile of hand) {
    const remaining = hand.filter((candidate) => candidate.id !== tile.id);
    const score =
      structureScore(tileCounts(remaining)) + discardBias(tile, remaining);
    if (score > bestScore || (score === bestScore && tile.kind > best.kind)) {
      best = tile;
      bestScore = score;
    }
  }
  return best;
}

export function chooseMahjongResponse(
  state: GuizhouMahjongState,
  playerIndex: number,
): MahjongResponseAction {
  const actions = pendingResponseActions(state, playerIndex);
  if (actions.includes("hu")) return "hu";
  if (actions.includes("gang") && state.wall.length > 8) return "gang";
  if (actions.includes("peng")) {
    const context = state.response;
    const player = state.players[playerIndex];
    if (context && player) {
      const before = structureScore(tileCounts(player.hand));
      const afterHand = [...player.hand];
      removeKinds(afterHand, context.tile.kind, 2);
      const after = structureScore(tileCounts(afterHand)) + 4.5;
      if (after > before + 1) return "peng";
    }
  }
  return "pass";
}

export function isWinningMahjongHand(tiles: readonly MahjongTile[]): boolean {
  if (tiles.length % 3 !== 2) return false;
  const counts = tileCounts(tiles);
  if (tiles.length === 14 && counts.filter((count) => count === 2).length === 7)
    return true;
  for (let kind = 0; kind < counts.length; kind += 1) {
    if ((counts[kind] ?? 0) < 2) continue;
    counts[kind] = (counts[kind] ?? 0) - 2;
    const complete = canFormMelds(counts);
    counts[kind] = (counts[kind] ?? 0) + 2;
    if (complete) return true;
  }
  return false;
}

export function sortMahjongTiles(tiles: MahjongTile[]): MahjongTile[] {
  return tiles.sort(
    (left, right) => left.kind - right.kind || left.id.localeCompare(right.id),
  );
}

export function mahjongKindLabel(kind: number): string {
  const rank = (kind % 9) + 1;
  return `${rank}${kind < 9 ? "万" : kind < 18 ? "筒" : "条"}`;
}

function buildResponseOptions(
  state: GuizhouMahjongState,
  discarderIndex: number,
  tile: MahjongTile,
): MahjongResponseOption[] {
  const options: MahjongResponseOption[] = [];
  for (let offset = 1; offset < state.players.length; offset += 1) {
    const playerIndex = (discarderIndex + offset) % state.players.length;
    const player = state.players[playerIndex];
    if (!player) continue;
    const count = player.hand.filter(
      (candidate) => candidate.kind === tile.kind,
    ).length;
    const actions: MahjongResponseAction[] = ["pass"];
    if (count >= 2) actions.push("peng");
    if (count >= 3) actions.push("gang");
    if (isWinningMahjongHand([...player.hand, tile])) actions.push("hu");
    if (actions.length > 1) options.push({ playerIndex, actions });
  }
  return options;
}

function resolveResponses(state: GuizhouMahjongState): void {
  const context = state.response;
  if (!context) return;
  const huWinners = context.decisions
    .filter((decision) => decision.action === "hu")
    .sort(
      (left, right) =>
        seatDistance(context.discarderIndex, left.playerIndex) -
        seatDistance(context.discarderIndex, right.playerIndex),
    );
  if (huWinners.length > 0) {
    state.phase = "finished";
    state.winners = huWinners.map((decision) => decision.playerIndex);
    state.winningTile = context.tile;
    state.winType = "dianpao";
    state.message = `${state.winners.map((index) => state.players[index]?.name).join("、")}胡${context.tile.label}`;
    delete state.response;
    return;
  }
  const claim = context.decisions
    .filter(
      (decision) => decision.action === "gang" || decision.action === "peng",
    )
    .sort((left, right) => {
      const priority =
        Number(right.action === "gang") - Number(left.action === "gang");
      return (
        priority ||
        seatDistance(context.discarderIndex, left.playerIndex) -
          seatDistance(context.discarderIndex, right.playerIndex)
      );
    })[0];
  if (!claim) {
    const discarder = context.discarderIndex;
    delete state.response;
    drawForNextPlayer(state, discarder);
    return;
  }
  const player = state.players[claim.playerIndex];
  const discarder = state.players[context.discarderIndex];
  if (!player || !discarder) return;
  const count = claim.action === "gang" ? 3 : 2;
  removeKinds(player.hand, context.tile.kind, count);
  discarder.discards.pop();
  player.melds.push({
    type: claim.action === "gang" ? "gang" : "peng",
    kind: context.tile.kind,
    fromPlayer: context.discarderIndex,
  });
  state.currentPlayerIndex = claim.playerIndex;
  state.phase = "discard";
  delete state.drawnTileId;
  sortMahjongTiles(player.hand);
  state.message = `${player.name}${claim.action === "gang" ? "杠" : "碰"}${context.tile.label}`;
  delete state.response;
  if (claim.action === "gang") drawReplacement(state, claim.playerIndex);
}

function drawForNextPlayer(
  state: GuizhouMahjongState,
  fromIndex: number,
): void {
  const next = (fromIndex + 1) % state.players.length;
  const tile = state.wall.pop();
  delete state.response;
  if (!tile) {
    state.phase = "finished";
    state.winners = [];
    state.message = "牌墙摸完，本局流局";
    return;
  }
  const player = state.players[next];
  player?.hand.push(tile);
  state.drawnTileId = tile.id;
  state.currentPlayerIndex = next;
  state.phase = "discard";
  state.turn += 1;
  state.message = `${player?.name ?? "玩家"}摸牌`;
}

function drawReplacement(
  state: GuizhouMahjongState,
  playerIndex: number,
): void {
  const tile = state.wall.shift();
  if (!tile) {
    state.phase = "finished";
    state.winners = [];
    state.message = "牌墙摸完，本局流局";
    return;
  }
  const player = state.players[playerIndex];
  player?.hand.push(tile);
  state.drawnTileId = tile.id;
  state.currentPlayerIndex = playerIndex;
  state.phase = "discard";
}

function tileCounts(tiles: readonly MahjongTile[]): number[] {
  const counts = Array.from({ length: 27 }, () => 0);
  for (const tile of tiles) counts[tile.kind] = (counts[tile.kind] ?? 0) + 1;
  return counts;
}

function canFormMelds(counts: number[]): boolean {
  const kind = counts.findIndex((count) => count > 0);
  if (kind < 0) return true;
  if ((counts[kind] ?? 0) >= 3) {
    counts[kind] = (counts[kind] ?? 0) - 3;
    if (canFormMelds(counts)) {
      counts[kind] = (counts[kind] ?? 0) + 3;
      return true;
    }
    counts[kind] = (counts[kind] ?? 0) + 3;
  }
  const rank = kind % 9;
  if (rank <= 6 && (counts[kind + 1] ?? 0) > 0 && (counts[kind + 2] ?? 0) > 0) {
    counts[kind] = (counts[kind] ?? 0) - 1;
    counts[kind + 1] = (counts[kind + 1] ?? 0) - 1;
    counts[kind + 2] = (counts[kind + 2] ?? 0) - 1;
    if (canFormMelds(counts)) {
      counts[kind] = (counts[kind] ?? 0) + 1;
      counts[kind + 1] = (counts[kind + 1] ?? 0) + 1;
      counts[kind + 2] = (counts[kind + 2] ?? 0) + 1;
      return true;
    }
    counts[kind] = (counts[kind] ?? 0) + 1;
    counts[kind + 1] = (counts[kind + 1] ?? 0) + 1;
    counts[kind + 2] = (counts[kind + 2] ?? 0) + 1;
  }
  return false;
}

function structureScore(counts: readonly number[]): number {
  let score = 0;
  for (let kind = 0; kind < counts.length; kind += 1) {
    const count = counts[kind] ?? 0;
    if (count >= 3) score += 5;
    else if (count === 2) score += 2.4;
    else if (count === 1) score += 0.2;
    const rank = kind % 9;
    if (count > 0 && rank < 8 && (counts[kind + 1] ?? 0) > 0) score += 1.2;
    if (count > 0 && rank < 7 && (counts[kind + 2] ?? 0) > 0) score += 0.45;
  }
  return score;
}

function discardBias(
  tile: MahjongTile,
  remaining: readonly MahjongTile[],
): number {
  const same = remaining.filter(
    (candidate) => candidate.kind === tile.kind,
  ).length;
  const neighbor = remaining.some(
    (candidate) =>
      candidate.suit === tile.suit && Math.abs(candidate.rank - tile.rank) <= 2,
  );
  return same === 0 && !neighbor
    ? 1.5
    : tile.rank === 1 || tile.rank === 9
      ? 0.3
      : 0;
}

function removeKinds(tiles: MahjongTile[], kind: number, count: number): void {
  for (let removed = 0; removed < count; removed += 1) {
    const index = tiles.findIndex((tile) => tile.kind === kind);
    if (index < 0) throw new Error("Required tile is missing");
    tiles.splice(index, 1);
  }
}

function seatDistance(from: number, to: number): number {
  return (to - from + 4) % 4;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [items[index], items[target]] = [items[target] as T, items[index] as T];
  }
  return items;
}

export function mahjongDiscardPlacements(
  playerIndex: number,
  count: number,
): MahjongTilePlacement[] {
  const visibleCount = Math.min(MAHJONG_DISCARD_CAPACITY, Math.max(0, count));
  return Array.from({ length: visibleCount }, (_, index) => {
    const lane = Math.floor(index / 9);
    const slot = index % 9;
    if (playerIndex === 0) {
      return {
        x: 608 + slot * 44 + lane * 16,
        y: 500 + lane * 56,
        width: 40,
        height: 54,
        angle: 0,
      };
    }
    if (playerIndex === 2) {
      return {
        x: 608 + slot * 44 - lane * 16,
        y: 236 + lane * 56,
        width: 40,
        height: 54,
        angle: 180,
      };
    }
    const leftSeat = playerIndex === 1;
    return {
      x: leftSeat ? 430 - lane * 58 : 1130 + lane * 58,
      y: 244 + slot * 44 + lane * 16,
      width: 40,
      height: 54,
      angle: leftSeat ? 90 : -90,
    };
  });
}

export function mahjongActionPlacements(
  actions: readonly MahjongResponseAction[],
): MahjongActionPlacement[] {
  const width = 92;
  const gap = 12;
  const right = 1516;
  const startX =
    right - actions.length * width - Math.max(0, actions.length - 1) * gap;
  return actions.map((action, index) => ({
    action,
    x: startX + index * (width + gap),
    y: 622,
    width,
    height: 92,
  }));
}

export function mahjongPlacementBounds(placement: MahjongTilePlacement): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const radians = (placement.angle * Math.PI) / 180;
  const rotatedWidth =
    Math.abs(Math.cos(radians)) * placement.width +
    Math.abs(Math.sin(radians)) * placement.height;
  const rotatedHeight =
    Math.abs(Math.sin(radians)) * placement.width +
    Math.abs(Math.cos(radians)) * placement.height;
  const centerX = placement.x + placement.width / 2;
  const centerY = placement.y + placement.height / 2;
  return {
    left: centerX - rotatedWidth / 2,
    top: centerY - rotatedHeight / 2,
    right: centerX + rotatedWidth / 2,
    bottom: centerY + rotatedHeight / 2,
  };
}
