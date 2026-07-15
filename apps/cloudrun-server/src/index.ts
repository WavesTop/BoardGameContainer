import { createServerApplication } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const application = createServerApplication(config);
const port = await application.listen();

console.log(
  JSON.stringify({
    level: "info",
    message: "boardgame runtime started",
    host: config.HOST,
    port,
    repository: config.BGC_REPOSITORY,
  }),
);

async function shutdown(signal: string): Promise<void> {
  console.log(
    JSON.stringify({ level: "info", message: "shutting down", signal }),
  );
  await application.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
