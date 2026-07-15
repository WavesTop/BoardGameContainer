import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node24",
  platform: "node",
  clean: true,
  dts: false,
  sourcemap: true,
  splitting: false,
  noExternal: ["@bgc/protocol", "@bgc/game-sdk", "@bgc/game-demo"],
});
