import "server-only";

import { z } from "zod";

/**
 * Server-only environment — secrets and settings that must never reach the
 * browser bundle. Deliberately **not** re-exported from `config/index.ts`
 * (which client code imports): import it as `@/config/server-env`, and only
 * from route handlers or `server.ts` feature entry points. The `server-only`
 * import makes an accidental client import a build error.
 */
const serverEnvSchema = z.object({
  /** Enables Claude vision for admission-form scanning. Optional. */
  ANTHROPIC_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  /**
   * Which engine reads scanned admission forms:
   * - `auto` (default): Claude when `ANTHROPIC_API_KEY` is set, otherwise the
   *   free offline reader.
   * - `offline`: always the offline reader (no data leaves the server).
   * - `claude`: always Claude; fails if no key is set.
   */
  ADMISSION_OCR_ENGINE: z.enum(["auto", "offline", "claude"]).default("auto"),
  /**
   * Folder with the offline reader's PaddleOCR model files. Defaults to the
   * `@gutenye/ocr-models` package's `assets/` folder in `node_modules`.
   */
  ADMISSION_OCR_MODEL_DIR: z.string().trim().optional(),
});

const parsed = serverEnvSchema.safeParse({
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ADMISSION_OCR_ENGINE: process.env.ADMISSION_OCR_ENGINE || undefined,
  ADMISSION_OCR_MODEL_DIR: process.env.ADMISSION_OCR_MODEL_DIR,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid server environment configuration:\n${issues}`);
}

export const serverEnv = Object.freeze(parsed.data);

export type ServerEnv = typeof serverEnv;
