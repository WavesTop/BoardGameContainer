import { afterEach, describe, expect, it } from "vitest";

import { createServerApplication, type ServerApplication } from "../src/app.js";
import { loadConfig } from "../src/config.js";

let application: ServerApplication | undefined;

afterEach(async () => {
  await application?.close();
  application = undefined;
});

describe("health endpoints", () => {
  it("reports healthy and ready in memory mode", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "3000",
      BGC_REPOSITORY: "memory",
      ALLOW_DEV_IDENTITY: "true",
    });
    application = createServerApplication(config);
    const port = await application.listen(0, "127.0.0.1");

    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    const ready = await fetch(`http://127.0.0.1:${port}/readyz`);

    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: "ok" });
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ repository: "memory" });
  });
});
