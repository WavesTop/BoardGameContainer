export type GameCategoryId = "cards" | "mahjong" | "party";
export type GameAvailability = "available" | "planned" | "research";

export interface GameCatalogItem {
  id: string;
  name: string;
  subtitle: string;
  players: string;
  duration: string;
  availability: GameAvailability;
  accent: string;
}

export interface GameCategory {
  id: GameCategoryId;
  name: string;
  summary: string;
  glyph: string;
  games: readonly GameCatalogItem[];
}

export const gameCategories: readonly GameCategory[] = [
  {
    id: "cards",
    name: "纸牌类",
    summary: "回合明确、上手快，适合先验证出牌、隐藏信息与结算链路。",
    glyph: "♠",
    games: [
      {
        id: "doudizhu",
        name: "斗地主",
        subtitle: "首款正式玩法",
        players: "3 人",
        duration: "10–20 分钟",
        availability: "available",
        accent: "#7B3436",
      },
      {
        id: "zhajinhua",
        name: "炸金花",
        subtitle: "好友房规划",
        players: "3–6 人",
        duration: "10–25 分钟",
        availability: "planned",
        accent: "#3D5C8A",
      },
      {
        id: "texas-holdem",
        name: "德州",
        subtitle: "长局与边池研究",
        players: "2–9 人",
        duration: "20–60 分钟",
        availability: "research",
        accent: "#6D4F82",
      },
    ],
  },
  {
    id: "mahjong",
    name: "麻将类",
    summary: "共用牌墙、摸打和响应窗口，地区规则作为独立规则包接入。",
    glyph: "東",
    games: [
      {
        id: "sichuan-mahjong",
        name: "四川麻将",
        subtitle: "血战到底方向",
        players: "4 人",
        duration: "20–40 分钟",
        availability: "planned",
        accent: "#2D6F63",
      },
      {
        id: "guizhou-mahjong",
        name: "贵州麻将",
        subtitle: "地区规则待冻结",
        players: "4 人",
        duration: "20–40 分钟",
        availability: "planned",
        accent: "#527443",
      },
      {
        id: "standard-mahjong",
        name: "国标麻将",
        subtitle: "复杂计番研究",
        players: "4 人",
        duration: "30–60 分钟",
        availability: "research",
        accent: "#8A6534",
      },
    ],
  },
  {
    id: "party",
    name: "聚会推理",
    summary: "覆盖多人阶段、身份投影、投票和语音等更复杂的平台能力。",
    glyph: "✦",
    games: [
      {
        id: "werewolf",
        name: "狼人杀",
        subtitle: "身份与阶段编排",
        players: "6–12 人",
        duration: "30–60 分钟",
        availability: "research",
        accent: "#5C3E68",
      },
      {
        id: "uno-like",
        name: "出牌接龙",
        subtitle: "原创规则与美术方向",
        players: "2–8 人",
        duration: "10–25 分钟",
        availability: "research",
        accent: "#7C4435",
      },
      {
        id: "social-deduction",
        name: "阵营推理",
        subtitle: "语音能力里程碑",
        players: "5–10 人",
        duration: "20–50 分钟",
        availability: "research",
        accent: "#315B73",
      },
    ],
  },
] as const;

export function getCategory(categoryId: GameCategoryId): GameCategory {
  return (
    gameCategories.find((category) => category.id === categoryId) ??
    gameCategories[0]
  );
}

export function getGame(gameId: string): GameCatalogItem | undefined {
  for (const category of gameCategories) {
    const game = category.games.find((item) => item.id === gameId);
    if (game) return game;
  }
  return undefined;
}
