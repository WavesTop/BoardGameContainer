import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import ts from "typescript";

const files = [
  "apps/game-client/assets/scripts/app/AppRoot.ts",
  "apps/game-client/assets/scripts/catalog/GameCatalog.ts",
  "apps/game-client/assets/scripts/core/BootController.ts",
  "apps/game-client/assets/scripts/core/network/NetworkPort.ts",
  "apps/game-client/assets/scripts/core/network/RealtimeClient.ts",
  "apps/game-client/assets/scripts/core/network/WechatGameSocket.ts",
  "apps/game-client/assets/scripts/core/state/MatchStore.ts",
  "apps/game-client/assets/scripts/core/theme/Theme.ts",
  "apps/game-client/assets/scripts/features/lobby/LobbyView.ts",
  "apps/game-client/assets/scripts/features/playtest/DoudizhuPlaytestModel.ts",
  "apps/game-client/assets/scripts/features/playtest/DoudizhuPlaytestView.ts",
  "apps/game-client/assets/scripts/features/playtest/TexasHoldemPlaytestModel.ts",
  "apps/game-client/assets/scripts/features/playtest/TexasHoldemPlaytestView.ts",
  "apps/game-client/assets/scripts/features/playtest/GuizhouMahjongPlaytestModel.ts",
  "apps/game-client/assets/scripts/features/playtest/GuizhouMahjongPlaytestView.ts",
  "apps/game-client/assets/scripts/ui/UiKit.ts",
];

let failed = false;
for (const relativePath of files) {
  const absolutePath = resolve(relativePath);
  const source = readFileSync(absolutePath, "utf8");
  const result = ts.transpileModule(source, {
    fileName: absolutePath,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      experimentalDecorators: true,
      useDefineForClassFields: true,
    },
  });
  for (const diagnostic of result.diagnostics ?? []) {
    failed = true;
    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      "\n",
    );
    console.error(`${relativePath}: ${message}`);
  }
}

if (failed) process.exit(1);
console.log(`Cocos syntax check passed for ${files.length} files.`);
