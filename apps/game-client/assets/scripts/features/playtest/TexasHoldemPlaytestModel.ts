export type PokerSuit = "spade" | "heart" | "club" | "diamond";

export interface PokerCard {
  id: string;
  suit: PokerSuit;
  rank: number;
  rankLabel: string;
  suitLabel: string;
}

export type TexasPhase = "preflop" | "flop" | "turn" | "river" | "finished";

export type TexasAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; raiseTo: number }
  | { type: "allIn" };

export interface TexasPlayer {
  id: string;
  name: string;
  stack: number;
  holeCards: PokerCard[];
  streetBet: number;
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  payout: number;
}

export interface TexasState {
  players: TexasPlayer[];
  dealerIndex: number;
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  phase: TexasPhase;
  currentPlayerIndex: number;
  communityCards: PokerCard[];
  deck: PokerCard[];
  pot: number;
  currentBet: number;
  minimumRaise: number;
  actedSinceRaise: number[];
  winners: number[];
  message: string;
}

export interface HandRank {
  category: number;
  kickers: number[];
  label: string;
}

export interface TexasRaiseBounds {
  minimum: number;
  maximum: number;
}

export interface TexasStateOptions {
  startingChips?: number;
  smallBlind?: number;
}

const SUITS: readonly { suit: PokerSuit; label: string }[] = [
  { suit: "spade", label: "♠" },
  { suit: "heart", label: "♥" },
  { suit: "club", label: "♣" },
  { suit: "diamond", label: "♦" },
];

const HAND_LABELS = [
  "高牌",
  "一对",
  "两对",
  "三条",
  "顺子",
  "同花",
  "葫芦",
  "四条",
  "同花顺",
] as const;

export function createPokerDeck(): PokerCard[] {
  const cards: PokerCard[] = [];
  for (let rank = 2; rank <= 14; rank += 1) {
    for (const suit of SUITS) {
      cards.push({
        id: `${suit.suit}-${rank}`,
        suit: suit.suit,
        rank,
        rankLabel:
          rank === 14
            ? "A"
            : rank === 13
              ? "K"
              : rank === 12
                ? "Q"
                : rank === 11
                  ? "J"
                  : String(rank),
        suitLabel: suit.label,
      });
    }
  }
  return cards;
}

export function createTexasState(
  names: readonly string[] = ["我", "阿策", "小满", "老周"],
  random: () => number = Math.random,
  options: TexasStateOptions = {},
): TexasState {
  if (names.length < 2 || names.length > 8) {
    throw new Error("Texas Hold'em requires 2 to 8 players");
  }
  const startingChips = options.startingChips ?? 1_000;
  const smallBlind = options.smallBlind ?? 10;
  if (!Number.isSafeInteger(startingChips) || startingChips <= 0) {
    throw new Error("Starting chips must be a positive integer");
  }
  if (
    !Number.isSafeInteger(smallBlind) ||
    smallBlind <= 0 ||
    smallBlind * 2 > startingChips
  ) {
    throw new Error("Small blind must fit within the starting stack");
  }
  const state: TexasState = {
    players: names.map((name, index) => ({
      id: `player-${index}`,
      name,
      stack: startingChips,
      holeCards: [],
      streetBet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      payout: 0,
    })),
    dealerIndex: 0,
    startingChips,
    smallBlind,
    bigBlind: smallBlind * 2,
    handNumber: 0,
    phase: "finished",
    currentPlayerIndex: 0,
    communityCards: [],
    deck: [],
    pot: 0,
    currentBet: 0,
    minimumRaise: smallBlind * 2,
    actedSinceRaise: [],
    winners: [],
    message: "",
  };
  startTexasHand(state, random, false);
  return state;
}

export function startTexasHand(
  state: TexasState,
  random: () => number = Math.random,
  rotateDealer = true,
): void {
  const funded = state.players.filter((player) => player.stack > 0);
  if (funded.length < 2) {
    state.phase = "finished";
    state.winners = state.players.flatMap((player, index) =>
      player.stack > 0 ? [index] : [],
    );
    state.message = "牌局结束，仅剩一名玩家拥有筹码";
    return;
  }
  if (rotateDealer) state.dealerIndex = nextFunded(state, state.dealerIndex);
  state.handNumber += 1;
  state.phase = "preflop";
  state.communityCards = [];
  state.deck = shuffle(createPokerDeck(), random);
  state.pot = 0;
  state.currentBet = 0;
  state.minimumRaise = state.bigBlind;
  state.actedSinceRaise = [];
  state.winners = [];
  for (const player of state.players) {
    player.holeCards = [];
    player.streetBet = 0;
    player.totalBet = 0;
    player.folded = player.stack <= 0;
    player.allIn = player.stack <= 0;
    player.payout = 0;
  }
  const eligible = state.players.flatMap((player, index) =>
    player.stack > 0 ? [index] : [],
  );
  for (let round = 0; round < 2; round += 1) {
    for (const index of eligible) {
      const card = state.deck.pop();
      if (card) state.players[index]?.holeCards.push(card);
    }
  }
  const smallBlindIndex =
    eligible.length === 2
      ? state.dealerIndex
      : nextFunded(state, state.dealerIndex);
  const bigBlindIndex = nextFunded(state, smallBlindIndex);
  commit(state, smallBlindIndex, state.smallBlind);
  commit(state, bigBlindIndex, state.bigBlind);
  state.currentBet = Math.max(
    state.players[smallBlindIndex]?.streetBet ?? 0,
    state.players[bigBlindIndex]?.streetBet ?? 0,
  );
  state.currentPlayerIndex = nextActor(state, bigBlindIndex);
  state.message = `${state.players[smallBlindIndex]?.name ?? "小盲"}下小盲，${state.players[bigBlindIndex]?.name ?? "大盲"}下大盲`;
}

export function legalTexasActions(
  state: TexasState,
  playerIndex: number,
): TexasAction["type"][] {
  if (state.phase === "finished" || state.currentPlayerIndex !== playerIndex)
    return [];
  const player = state.players[playerIndex];
  if (!player || player.folded || player.allIn) return [];
  const toCall = Math.max(0, state.currentBet - player.streetBet);
  const actions: TexasAction["type"][] = [
    "fold",
    toCall === 0 ? "check" : "call",
  ];
  if (player.stack > toCall) actions.push("raise");
  if (player.stack > 0) actions.push("allIn");
  return actions;
}

export function texasRaiseBounds(
  state: TexasState,
  playerIndex: number,
): TexasRaiseBounds | undefined {
  const player = state.players[playerIndex];
  if (!player) return undefined;
  const maximum = player.streetBet + player.stack;
  if (maximum <= state.currentBet) return undefined;
  return {
    minimum: Math.min(maximum, state.currentBet + state.minimumRaise),
    maximum,
  };
}

export function actTexas(
  state: TexasState,
  playerIndex: number,
  action: TexasAction,
): void {
  if (!legalTexasActions(state, playerIndex).includes(action.type)) {
    throw new Error("Illegal Texas Hold'em action");
  }
  const player = state.players[playerIndex];
  if (!player) throw new Error("Player is missing");
  const toCall = Math.max(0, state.currentBet - player.streetBet);
  if (action.type === "fold") {
    player.folded = true;
    state.message = `${player.name}弃牌`;
  } else if (action.type === "check") {
    if (toCall !== 0) throw new Error("Cannot check facing a bet");
    state.message = `${player.name}过牌`;
  } else if (action.type === "call") {
    const paid = commit(state, playerIndex, toCall);
    state.message = `${player.name}${paid < toCall ? "全下" : "跟注"}${paid}`;
  } else if (action.type === "raise") {
    const bounds = texasRaiseBounds(state, playerIndex);
    const raiseTo = action.raiseTo;
    if (!bounds || !Number.isSafeInteger(raiseTo) || raiseTo < bounds.minimum) {
      throw new Error("Raise does not meet the minimum size");
    }
    if (raiseTo > bounds.maximum) {
      throw new Error("Raise exceeds the player's stack");
    }
    const previous = state.currentBet;
    commit(state, playerIndex, raiseTo - player.streetBet);
    state.currentBet = player.streetBet;
    const raiseSize = state.currentBet - previous;
    if (raiseSize >= state.minimumRaise) state.minimumRaise = raiseSize;
    state.actedSinceRaise = [];
    state.message = `${player.name}加注到${state.currentBet}`;
  } else {
    const previous = state.currentBet;
    commit(state, playerIndex, player.stack);
    if (player.streetBet > state.currentBet) {
      state.currentBet = player.streetBet;
      const raiseSize = state.currentBet - previous;
      if (raiseSize >= state.minimumRaise) {
        state.minimumRaise = raiseSize;
        state.actedSinceRaise = [];
      }
    }
    state.message = `${player.name}全下到${player.streetBet}`;
  }
  if (!state.actedSinceRaise.includes(playerIndex))
    state.actedSinceRaise.push(playerIndex);
  progress(state, playerIndex);
}

export function chooseTexasAiAction(
  state: TexasState,
  playerIndex: number,
  random: () => number = Math.random,
): TexasAction {
  const player = state.players[playerIndex];
  if (!player) throw new Error("Player is missing");
  const legal = legalTexasActions(state, playerIndex);
  if (legal.length === 0) throw new Error("AI has no legal action");
  const toCall = Math.max(0, state.currentBet - player.streetBet);
  const strength = estimateStrength(player.holeCards, state.communityCards);
  const potOdds = toCall / Math.max(1, state.pot + toCall);
  const pressure = toCall / Math.max(1, player.stack + player.streetBet);
  const mood = random();
  if (toCall === 0) {
    if (legal.includes("raise") && (strength > 0.7 || mood > 0.94)) {
      return { type: "raise", raiseTo: aiRaiseTarget(state, player) };
    }
    return { type: "check" };
  }
  if (strength > 0.9 && pressure > 0.4) return { type: "allIn" };
  if (strength > 0.76 && legal.includes("raise")) {
    return { type: "raise", raiseTo: aiRaiseTarget(state, player) };
  }
  if (strength + mood * 0.12 >= potOdds + pressure * 0.24) {
    return player.stack <= toCall ? { type: "allIn" } : { type: "call" };
  }
  return { type: "fold" };
}

export function evaluateBestHand(cards: readonly PokerCard[]): HandRank {
  if (cards.length < 5) throw new Error("At least five cards are required");
  let best: HandRank | undefined;
  for (let a = 0; a < cards.length - 4; a += 1)
    for (let b = a + 1; b < cards.length - 3; b += 1)
      for (let c = b + 1; c < cards.length - 2; c += 1)
        for (let d = c + 1; d < cards.length - 1; d += 1)
          for (let e = d + 1; e < cards.length; e += 1) {
            const rank = evaluateFive([
              cards[a] as PokerCard,
              cards[b] as PokerCard,
              cards[c] as PokerCard,
              cards[d] as PokerCard,
              cards[e] as PokerCard,
            ]);
            if (!best || compareHandRanks(rank, best) > 0) best = rank;
          }
  if (!best) throw new Error("Could not evaluate hand");
  return best;
}

export function compareHandRanks(left: HandRank, right: HandRank): number {
  if (left.category !== right.category) return left.category - right.category;
  for (
    let index = 0;
    index < Math.max(left.kickers.length, right.kickers.length);
    index += 1
  ) {
    const difference = (left.kickers[index] ?? 0) - (right.kickers[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function pokerCardText(card: PokerCard): string {
  return `${card.rankLabel}${card.suitLabel}`;
}

function progress(state: TexasState, actorIndex: number): void {
  const contenders = state.players.flatMap((player, index) =>
    player.folded ? [] : [index],
  );
  if (contenders.length === 1) {
    settleUncontested(state, contenders[0] ?? actorIndex);
  } else if (bettingComplete(state)) {
    advanceStreet(state);
  } else {
    state.currentPlayerIndex = nextActor(state, actorIndex);
  }
}

function bettingComplete(state: TexasState): boolean {
  return state.players.every(
    (player, index) =>
      player.folded ||
      player.allIn ||
      (player.streetBet === state.currentBet &&
        state.actedSinceRaise.includes(index)),
  );
}

function advanceStreet(state: TexasState): void {
  for (const player of state.players) player.streetBet = 0;
  state.currentBet = 0;
  state.minimumRaise = state.bigBlind;
  state.actedSinceRaise = [];
  if (state.phase === "river") {
    settleShowdown(state);
    return;
  }
  state.deck.pop();
  const count = state.phase === "preflop" ? 3 : 1;
  for (let index = 0; index < count; index += 1) {
    const card = state.deck.pop();
    if (card) state.communityCards.push(card);
  }
  state.phase =
    state.phase === "preflop"
      ? "flop"
      : state.phase === "flop"
        ? "turn"
        : "river";
  state.currentPlayerIndex = nextActor(state, state.dealerIndex);
  state.message = `${state.phase === "flop" ? "翻牌" : state.phase === "turn" ? "转牌" : "河牌"}圈开始`;
  if (!state.players.some((player) => !player.folded && !player.allIn))
    advanceStreet(state);
}

function settleUncontested(state: TexasState, winnerIndex: number): void {
  const winner = state.players[winnerIndex];
  if (!winner) return;
  winner.stack += state.pot;
  winner.payout = state.pot;
  state.winners = [winnerIndex];
  state.phase = "finished";
  state.message = `${winner.name}赢得底池${state.pot}`;
}

function settleShowdown(state: TexasState): void {
  const levels = [
    ...new Set(
      state.players.map((player) => player.totalBet).filter((bet) => bet > 0),
    ),
  ].sort((a, b) => a - b);
  let previous = 0;
  const allWinners = new Set<number>();
  for (const level of levels) {
    const contributors = state.players.flatMap((player, index) =>
      player.totalBet >= level ? [{ player, index }] : [],
    );
    const sidePot = (level - previous) * contributors.length;
    previous = level;
    let best: HandRank | undefined;
    let winners: number[] = [];
    for (const { player, index } of contributors.filter(
      ({ player }) => !player.folded,
    )) {
      const rank = evaluateBestHand([
        ...player.holeCards,
        ...state.communityCards,
      ]);
      const comparison = best ? compareHandRanks(rank, best) : 1;
      if (comparison > 0) {
        best = rank;
        winners = [index];
      } else if (comparison === 0) winners.push(index);
    }
    const share = Math.floor(sidePot / Math.max(1, winners.length));
    let remainder = sidePot - share * winners.length;
    for (const index of winners) {
      const player = state.players[index];
      if (!player) continue;
      const extra = remainder-- > 0 ? 1 : 0;
      player.stack += share + extra;
      player.payout += share + extra;
      allWinners.add(index);
    }
  }
  state.winners = [...allWinners];
  state.phase = "finished";
  state.message = `${state.winners
    .map((index) => state.players[index]?.name)
    .filter(Boolean)
    .join("、")}赢得本手牌`;
}

function commit(
  state: TexasState,
  playerIndex: number,
  amount: number,
): number {
  const player = state.players[playerIndex];
  if (!player) return 0;
  const paid = Math.max(0, Math.min(player.stack, amount));
  player.stack -= paid;
  player.streetBet += paid;
  player.totalBet += paid;
  state.pot += paid;
  if (player.stack === 0) player.allIn = true;
  return paid;
}

function nextActor(state: TexasState, fromIndex: number): number {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const index = (fromIndex + offset) % state.players.length;
    const player = state.players[index];
    if (player && !player.folded && !player.allIn) return index;
  }
  return fromIndex;
}

function nextFunded(state: TexasState, fromIndex: number): number {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const index = (fromIndex + offset) % state.players.length;
    if ((state.players[index]?.stack ?? 0) > 0) return index;
  }
  return fromIndex;
}

function evaluateFive(cards: readonly PokerCard[]): HandRank {
  const ranks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort(
    ([ar, ac], [br, bc]) => bc - ac || br - ar,
  );
  const flush = cards.every((card) => card.suit === cards[0]?.suit);
  const straight = straightHigh(ranks);
  if (flush && straight) return makeRank(8, [straight]);
  if (groups[0]?.[1] === 4)
    return makeRank(7, [groups[0][0], groups[1]?.[0] ?? 0]);
  if (groups[0]?.[1] === 3 && groups[1]?.[1] === 2)
    return makeRank(6, [groups[0][0], groups[1][0]]);
  if (flush) return makeRank(5, ranks);
  if (straight) return makeRank(4, [straight]);
  if (groups[0]?.[1] === 3)
    return makeRank(3, [
      groups[0][0],
      ...groups.slice(1).map(([rank]) => rank),
    ]);
  if (groups[0]?.[1] === 2 && groups[1]?.[1] === 2) {
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    return makeRank(2, [...pairs, groups[2]?.[0] ?? 0]);
  }
  if (groups[0]?.[1] === 2)
    return makeRank(1, [
      groups[0][0],
      ...groups.slice(1).map(([rank]) => rank),
    ]);
  return makeRank(0, ranks);
}

function makeRank(category: number, kickers: number[]): HandRank {
  return { category, kickers, label: HAND_LABELS[category] ?? "高牌" };
}

function straightHigh(ranks: readonly number[]): number {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique[0] === 14) unique.push(1);
  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    run = (unique[index - 1] ?? 0) - (unique[index] ?? 0) === 1 ? run + 1 : 1;
    if (run >= 5) return unique[index - 4] ?? 0;
  }
  return 0;
}

function estimateStrength(
  hole: readonly PokerCard[],
  board: readonly PokerCard[],
): number {
  if (board.length >= 3) {
    const rank = evaluateBestHand([...hole, ...board]);
    return Math.min(
      1,
      (rank.category / 8) * 0.82 + ((rank.kickers[0] ?? 2) / 14) * 0.18,
    );
  }
  const first = hole[0];
  const second = hole[1];
  if (!first || !second) return 0;
  const high = Math.max(first.rank, second.rank) / 14;
  const low = Math.min(first.rank, second.rank) / 14;
  if (first.rank === second.rank) return 0.52 + high * 0.42;
  return Math.min(
    0.82,
    high * 0.48 +
      low * 0.22 +
      (first.suit === second.suit ? 0.08 : 0) +
      (Math.abs(first.rank - second.rank) <= 2 ? 0.07 : 0),
  );
}

function aiRaiseTarget(state: TexasState, player: TexasPlayer): number {
  return Math.min(
    player.streetBet + player.stack,
    state.currentBet +
      Math.max(state.minimumRaise, Math.round(state.pot * 0.6)),
  );
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [items[index], items[target]] = [items[target] as T, items[index] as T];
  }
  return items;
}
