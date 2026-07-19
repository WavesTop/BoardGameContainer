import type {
  DoudizhuRoomRules,
  FriendRoomGameId,
  FriendRoomRulesConfig,
  GuizhouMahjongRoomRules,
  RoomMemberView,
  RoomRulesConfig,
  TexasHoldemRoomRules,
} from "../../core/network/RealtimeClient";

export function orderRoomPlayerNames(
  members: readonly RoomMemberView[],
  selfUserId?: string,
): string[] {
  const self = members.find((member) => member.userId === selfUserId);
  return [
    ...(self ? [self] : []),
    ...members.filter((member) => member !== self),
  ].map((member) => member.displayName);
}

export function createDefaultRoomRules(
  gameId: FriendRoomGameId,
): FriendRoomRulesConfig {
  if (gameId === "texas-holdem") {
    const rules: TexasHoldemRoomRules = {
      rulesetId: "texas-holdem.friend.v1",
      playerCount: 4,
      startingChips: 1000,
      smallBlind: 10,
      turnSeconds: 30,
    };
    return rules;
  }
  if (gameId === "guizhou-mahjong") {
    const rules: GuizhouMahjongRoomRules = {
      rulesetId: "guizhou-mahjong.friend.v1",
      playerCount: 4,
      roundCount: 4,
      turnSeconds: 30,
      allowSevenPairs: true,
      allowMultipleWinners: true,
    };
    return rules;
  }
  const rules: DoudizhuRoomRules = {
    rulesetId: "doudizhu.friend.v1",
    playerCount: 3,
    roundCount: 4,
    multiplierCap: 64,
    turnSeconds: 30,
    allowAutoPlay: true,
  };
  return rules;
}

export function resolveRoomRules(
  gameId: string,
  rulesConfig?: RoomRulesConfig,
): RoomRulesConfig {
  if (rulesConfig) return rulesConfig;
  if (
    gameId === "texas-holdem" ||
    gameId === "doudizhu" ||
    gameId === "guizhou-mahjong"
  ) {
    return createDefaultRoomRules(gameId);
  }
  return { rulesetId: "demo.friend.v1", playerCount: 4 };
}

export function roomRuleSummary(
  rules: RoomRulesConfig,
  multiline = false,
): string {
  const separator = multiline ? "\n" : "  ·  ";
  switch (rules.rulesetId) {
    case "texas-holdem.friend.v1":
      return `${rules.playerCount} 人 · ${rules.startingChips} 筹码${separator}盲注 ${rules.smallBlind}/${rules.smallBlind * 2} · ${rules.turnSeconds} 秒操作`;
    case "guizhou-mahjong.friend.v1":
      return `${rules.roundCount} 局 · 108 张 · ${rules.turnSeconds} 秒操作${separator}${rules.allowSevenPairs ? "七对" : "不含七对"} · ${rules.allowMultipleWinners ? "一炮多响" : "截胡"}`;
    case "doudizhu.friend.v1":
      return `${rules.roundCount} 局 · 倍数上限 ${rules.multiplierCap}${separator}${rules.turnSeconds} 秒操作 · ${rules.allowAutoPlay ? "允许托管" : "关闭托管"}`;
    case "demo.friend.v1":
      return "4 人 · 演示规则";
  }
}
