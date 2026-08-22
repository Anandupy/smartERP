import { appConfig } from "@/config";

/**
 * Locale-aware formatting helpers. Pure and dependency-free so they are safe to
 * use on both server and client. Business-specific formatting (currency codes,
 * fee rounding rules) belongs to the owning feature, not here.
 */

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale: string = appConfig.defaultLocale,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  locale: string = appConfig.defaultLocale,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Date and time together — the default for audit trails and activity feeds,
 * where the time of day is the point and a bare date is not enough to order two
 * entries.
 */
export function formatDateTime(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
  locale: string = appConfig.defaultLocale,
): string {
  return formatDate(value, options, locale);
}

/** Byte count as a human-readable size (`"10 MB"`, `"512 KB"`). Base-1000, matching how file sizes are commonly quoted. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1000)),
    units.length - 1,
  );
  const value = bytes / 1000 ** exponent;
  const formatted = exponent === 0 ? String(value) : value.toFixed(value < 10 ? 1 : 0);
  return `${formatted} ${units[exponent]}`;
}

export function truncate(value: string, max: number): string {
  return value.length > max
    ? `${value.slice(0, Math.max(0, max - 1))}…`
    : value;
}

export function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
