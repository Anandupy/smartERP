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
