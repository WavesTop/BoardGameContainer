import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ALLOW_DEV_IDENTITY: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  TCB_ENV_ID: z.string().optional(),
  TCB_SERVICE_NAME: z.string().default("boardgame-runtime"),
  BGC_REPOSITORY: z.enum(["memory", "cloudbase"]).default("memory"),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const result = configSchema.safeParse(environment);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration: ${result.error.message}`,
    );
  }

  if (result.data.BGC_REPOSITORY === "cloudbase" && !result.data.TCB_ENV_ID) {
    throw new Error("TCB_ENV_ID is required when BGC_REPOSITORY=cloudbase");
  }

  return result.data;
}
