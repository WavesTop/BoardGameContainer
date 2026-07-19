export type CardSuit = "spade" | "heart" | "club" | "diamond" | "joker";

export interface PlaytestCard {
  id: string;
  suit: CardSuit;
  rank: number;
  rankLabel: string;
  suitLabel: string;
}

export type PlayType =
  | "single"
  | "pair"
  | "triple"
  | "tripleSingle"
  | "triplePair"
  | "straight"
  | "pairStraight"
  | "bomb"
  | "rocket";

export interface PlayCombo {
  type: PlayType;
  keyRank: number;
  length: number;
}

export interface PlaytestDeal {
  hands: [PlaytestCard[], PlaytestCard[], PlaytestCard[]];
  bottomCards: PlaytestCard[];
}

export interface DoudizhuAiContext {
  playerIndex: number;
  previousPlayerIndex?: number;
  handCounts: readonly number[];
}

const standardRanks = [
  { rank: 3, label: "3" },
  { rank: 4, label: "4" },
  { rank: 5, label: "5" },
  { rank: 6, label: "6" },
  { rank: 7, label: "7" },
  { rank: 8, label: "8" },
  { rank: 9, label: "9" },
  { rank: 10, label: "10" },
  { rank: 11, label: "J" },
  { rank: 12, label: "Q" },
  { rank: 13, label: "K" },
  { rank: 14, label: "A" },
  { rank: 15, label: "2" },
] as const;

const suits = [
  { suit: "spade", label: "♠" },
  { suit: "heart", label: "♥" },
  { suit: "club", label: "♣" },
  { suit: "diamond", label: "♦" },
] as const;

export function createPlaytestDeck(): PlaytestCard[] {
  const cards: PlaytestCard[] = [];
  for (const rank of standardRanks) {
    for (const suit of suits) {
      cards.push({
        id: `${suit.suit}-${rank.rank}`,
        suit: suit.suit,
        rank: rank.rank,
        rankLabel: rank.label,
        suitLabel: suit.label,
      });
    }
  }
  cards.push({
    id: "joker-small",
    suit: "joker",
    rank: 16,
    rankLabel: "小王",
    suitLabel: "",
  });
  cards.push({
    id: "joker-big",
    suit: "joker",
    rank: 17,
    rankLabel: "大王",
    suitLabel: "",
  });
  return cards;
}

export function createPlaytestDeal(
  random: () => number = Math.random,
): PlaytestDeal {
  const deck = createPlaytestDeck();
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [deck[index], deck[target]] = [deck[target], deck[index]];
  }

  const bottomCards = deck.slice(51);
  const hands: [PlaytestCard[], PlaytestCard[], PlaytestCard[]] = [
    deck.slice(0, 17),
    deck.slice(17, 34),
    deck.slice(34, 51),
  ];
  hands[0].push(...bottomCards);
  for (const hand of hands) sortCards(hand);
  return { hands, bottomCards: sortCards([...bottomCards]) };
}

export function sortCards(cards: PlaytestCard[]): PlaytestCard[] {
  return cards.sort(
    (left, right) =>
      left.rank - right.rank || left.suit.localeCompare(right.suit),
  );
}

export function classifyPlay(cards: readonly PlaytestCard[]): PlayCombo | null {
  if (cards.length === 0) return null;
  const groups = groupCards(cards);
  const entries = Array.from(groups.entries()).sort(
    ([left], [right]) => left - right,
  );
  const counts = entries.map(([, group]) => group.length).sort((a, b) => a - b);

  if (cards.length === 1)
    return { type: "single", keyRank: cards[0].rank, length: 1 };
  if (cards.length === 2) {
    if (groups.has(16) && groups.has(17))
      return { type: "rocket", keyRank: 17, length: 2 };
    if (entries.length === 1)
      return { type: "pair", keyRank: entries[0][0], length: 2 };
    return null;
  }
  if (cards.length === 3 && entries.length === 1)
    return { type: "triple", keyRank: entries[0][0], length: 3 };
  if (cards.length === 4) {
    if (entries.length === 1)
      return { type: "bomb", keyRank: entries[0][0], length: 4 };
    if (counts.join(",") === "1,3")
      return {
        type: "tripleSingle",
        keyRank: entries.find(([, group]) => group.length === 3)?.[0] ?? 0,
        length: 4,
      };
  }
  if (cards.length === 5 && counts.join(",") === "2,3")
    return {
      type: "triplePair",
      keyRank: entries.find(([, group]) => group.length === 3)?.[0] ?? 0,
      length: 5,
    };

  const ranks = entries.map(([rank]) => rank);
  if (
    cards.length >= 5 &&
    entries.every(([, group]) => group.length === 1) &&
    isConsecutive(ranks)
  ) {
    return {
      type: "straight",
      keyRank: ranks[ranks.length - 1],
      length: cards.length,
    };
  }
  if (
    cards.length >= 6 &&
    cards.length % 2 === 0 &&
    entries.every(([, group]) => group.length === 2) &&
    isConsecutive(ranks)
  ) {
    return {
      type: "pairStraight",
      keyRank: ranks[ranks.length - 1],
      length: cards.length,
    };
  }
  return null;
}

export function canBeat(candidate: PlayCombo, previous: PlayCombo): boolean {
  if (candidate.type === "rocket") return previous.type !== "rocket";
  if (previous.type === "rocket") return false;
  if (candidate.type === "bomb") {
    return previous.type !== "bomb" || candidate.keyRank > previous.keyRank;
  }
  if (previous.type === "bomb") return false;
  return (
    candidate.type === previous.type &&
    candidate.length === previous.length &&
    candidate.keyRank > previous.keyRank
  );
}

export function findSuggestedPlay(
  hand: readonly PlaytestCard[],
  previous?: PlayCombo,
  context?: DoudizhuAiContext,
): PlaytestCard[] | null {
  const sortedHand = sortCards([...hand]);
  if (!previous) return findLeadPlay(sortedHand);
  if (previous.type === "rocket") return null;

  const teammateLed =
    context &&
    context.playerIndex !== 0 &&
    context.previousPlayerIndex !== undefined &&
    context.previousPlayerIndex !== 0 &&
    context.previousPlayerIndex !== context.playerIndex;
  if (teammateLed && (context.handCounts[0] ?? 99) > 1) return null;

  const groups = groupCards(sortedHand);
  const matching = findMatchingPlay(sortedHand, groups, previous);
  if (matching) return sortCards(matching);

  const shouldSpendBomb = sortedHand.length <= 6 || previous.keyRank >= 14;
  if (previous.type !== "bomb" && shouldSpendBomb) {
    const bomb = firstGroup(groups, 4, 0);
    if (bomb) return [...bomb];
  }
  if (previous.type === "bomb") {
    const bomb = firstGroup(groups, 4, previous.keyRank);
    if (bomb) return [...bomb];
  }
  const smallJoker = groups.get(16)?.[0];
  const bigJoker = groups.get(17)?.[0];
  return smallJoker && bigJoker ? [smallJoker, bigJoker] : null;
}

function findLeadPlay(hand: readonly PlaytestCard[]): PlaytestCard[] | null {
  if (hand.length === 0) return null;
  const groups = groupCards(hand);
  const pairRun = findLongestSequence(groups, 2, 3);
  if (pairRun) return pairRun;
  const straight = findLongestSequence(groups, 1, 5);
  if (straight) return straight;

  const triple = groupsAbove(groups, 3, 0).find((cards) => cards.length < 4);
  if (triple) {
    const pair = Array.from(groups.values()).find(
      (cards) => cards.length === 2 && cards[0]?.rank !== triple[0]?.rank,
    );
    if (pair) return [...triple.slice(0, 3), ...pair];
    const kicker = hand.find(
      (card) =>
        card.rank !== triple[0]?.rank &&
        (groups.get(card.rank)?.length ?? 0) === 1,
    );
    if (kicker) return [...triple.slice(0, 3), kicker];
    return triple.slice(0, 3);
  }

  const pair = Array.from(groups.values()).find((cards) => cards.length === 2);
  if (pair) return [...pair];
  const isolated = hand.find(
    (card) => (groups.get(card.rank)?.length ?? 0) === 1,
  );
  return [isolated ?? (hand[0] as PlaytestCard)];
}

function findLongestSequence(
  groups: Map<number, PlaytestCard[]>,
  copies: number,
  minimumRanks: number,
): PlaytestCard[] | null {
  let best: PlaytestCard[] | null = null;
  for (let start = 3; start <= 14; start += 1) {
    const cards: PlaytestCard[] = [];
    for (let rank = start; rank <= 14; rank += 1) {
      const group = groups.get(rank);
      if (!group || group.length < copies) break;
      cards.push(...group.slice(0, copies));
      if (
        cards.length >= minimumRanks * copies &&
        (!best || cards.length > best.length)
      ) {
        best = [...cards];
      }
    }
  }
  return best;
}

export function comboLabel(combo: PlayCombo): string {
  const labels: Record<PlayType, string> = {
    single: "单张",
    pair: "对子",
    triple: "三张",
    tripleSingle: "三带一",
    triplePair: "三带一对",
    straight: "顺子",
    pairStraight: "连对",
    bomb: "炸弹",
    rocket: "王炸",
  };
  return labels[combo.type];
}

export function doudizhuHandPower(cards: readonly PlaytestCard[]): number {
  const rankCounts = new Map<number, number>();
  let score = 0;
  for (const card of cards) {
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
    if (card.rank >= 15) score += card.rank - 12;
  }
  for (const count of rankCounts.values()) {
    if (count === 4) score += 8;
    else if (count === 3) score += 3;
    else if (count === 2) score += 1;
  }
  return score;
}

export function shouldCallLandlord(
  cards: readonly PlaytestCard[],
  hasCaller: boolean,
  forced = false,
): boolean {
  return forced || doudizhuHandPower(cards) >= (hasCaller ? 22 : 15);
}

function findMatchingPlay(
  hand: readonly PlaytestCard[],
  groups: Map<number, PlaytestCard[]>,
  previous: PlayCombo,
): PlaytestCard[] | null {
  switch (previous.type) {
    case "single": {
      const card = hand.find((candidate) => candidate.rank > previous.keyRank);
      return card ? [card] : null;
    }
    case "pair":
      return firstGroup(groups, 2, previous.keyRank)?.slice(0, 2) ?? null;
    case "triple":
      return firstGroup(groups, 3, previous.keyRank)?.slice(0, 3) ?? null;
    case "tripleSingle": {
      for (const triple of groupsAbove(groups, 3, previous.keyRank)) {
        const kicker = hand.find((card) => card.rank !== triple[0].rank);
        if (kicker) return [...triple.slice(0, 3), kicker];
      }
      return null;
    }
    case "triplePair": {
      for (const triple of groupsAbove(groups, 3, previous.keyRank)) {
        const pair = Array.from(groups.values()).find(
          (group) => group.length >= 2 && group[0].rank !== triple[0].rank,
        );
        if (pair) return [...triple.slice(0, 3), ...pair.slice(0, 2)];
      }
      return null;
    }
    case "straight":
      return findSequence(groups, previous.length, 1, previous.keyRank);
    case "pairStraight":
      return findSequence(groups, previous.length / 2, 2, previous.keyRank);
    case "bomb":
      return firstGroup(groups, 4, previous.keyRank)?.slice(0, 4) ?? null;
    case "rocket":
      return null;
  }
}

function findSequence(
  groups: Map<number, PlaytestCard[]>,
  rankCount: number,
  copiesPerRank: number,
  previousHighRank: number,
): PlaytestCard[] | null {
  for (let start = 3; start + rankCount - 1 <= 14; start += 1) {
    const highRank = start + rankCount - 1;
    if (highRank <= previousHighRank) continue;
    const sequence: PlaytestCard[] = [];
    let complete = true;
    for (let rank = start; rank <= highRank; rank += 1) {
      const group = groups.get(rank);
      if (!group || group.length < copiesPerRank) {
        complete = false;
        break;
      }
      sequence.push(...group.slice(0, copiesPerRank));
    }
    if (complete) return sequence;
  }
  return null;
}

function firstGroup(
  groups: Map<number, PlaytestCard[]>,
  count: number,
  minimumRank: number,
): PlaytestCard[] | undefined {
  return groupsAbove(groups, count, minimumRank)[0];
}

function groupsAbove(
  groups: Map<number, PlaytestCard[]>,
  count: number,
  minimumRank: number,
): PlaytestCard[][] {
  return Array.from(groups.entries())
    .filter(([rank, cards]) => rank > minimumRank && cards.length >= count)
    .sort(([left], [right]) => left - right)
    .map(([, cards]) => cards);
}

function groupCards(
  cards: readonly PlaytestCard[],
): Map<number, PlaytestCard[]> {
  const groups = new Map<number, PlaytestCard[]>();
  for (const card of cards) {
    const group = groups.get(card.rank) ?? [];
    group.push(card);
    groups.set(card.rank, group);
  }
  return groups;
}

function isConsecutive(ranks: readonly number[]): boolean {
  if (ranks.length === 0 || ranks[ranks.length - 1] > 14) return false;
  return ranks.every(
    (rank, index) => index === 0 || rank === ranks[index - 1] + 1,
  );
}
