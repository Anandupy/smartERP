import { env } from "./env";

/**
 * Static, non-secret application metadata. Business-specific configuration
 * belongs to its own feature module, not here.
 */
export const appConfig = Object.freeze({
  name: env.NEXT_PUBLIC_APP_NAME,
  description: "CampusFlow ERP",
  /** Default locale; wired up when i18n lands. */
  defaultLocale: "en",
  /** Default direction; workspace themes may override to "rtl" later. */
  direction: "ltr" as const,
});

export type AppConfig = typeof appConfig;
