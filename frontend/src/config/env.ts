import { z } from "zod";

/**
 * Runtime-validated environment configuration.
 *
 * Only `NEXT_PUBLIC_*` variables are readable in the browser. Access must go
 * through this module so that a missing or malformed value fails fast at
 * startup instead of surfacing as an obscure runtime bug later.
 *
 * `process.env` keys are referenced statically (not via a dynamic index) so
 * that the Next.js compiler can inline the values at build time.
 */
const envSchema = z.object({
  /** Unversioned API origin — the version segment is appended separately. */
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3001"),
  /**
   * Backend API version segment appended to the API root
   * (`http://localhost:3001` → `http://localhost:3001/v1`). The backend
   * versions its surface, so the frontend never hard-codes `v1` into request
   * paths — see `api.config.ts` and `docs/api-layer.md`.
   */
  NEXT_PUBLIC_API_VERSION: z
    .string()
    .regex(/^v\d+$/, "must look like 'v1'")
    .default("v1"),
  NEXT_PUBLIC_API_TIMEOUT: z.coerce.number().int().positive().default(30_000),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("CampusFlow"),
  NEXT_PUBLIC_APP_VERSION: z.string().min(1).default("4.2.0"),
  NEXT_PUBLIC_APP_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default("development"),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_API_VERSION: process.env.NEXT_PUBLIC_API_VERSION,
  NEXT_PUBLIC_API_TIMEOUT: process.env.NEXT_PUBLIC_API_TIMEOUT,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
});

if (!parsed.success) {
  // Fail loudly during boot so misconfiguration is never silently ignored.
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = Object.freeze(parsed.data);

export type Env = typeof env;

export const isProduction = env.NEXT_PUBLIC_APP_ENV === "production";
export const isDevelopment = env.NEXT_PUBLIC_APP_ENV === "development";
export const isTest = env.NEXT_PUBLIC_APP_ENV === "test";
