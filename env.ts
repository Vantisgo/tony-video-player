import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Runtime ops/telemetry (optional — features degrade/fail-open when unset,
    // so the app builds and runs without the ops infra provisioned).
    EDGE_CONFIG: z.string().optional(),
    RUNTIME_ALERT_WEBHOOK_URL: z.string().url().optional(),
    RUNTIME_TELEMETRY_ALLOWED_ORIGINS: z.string().optional(),
  },
  client: {},
  experimental__runtimeEnv: {
    ...process.env,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
