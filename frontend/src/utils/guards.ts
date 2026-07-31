import type { Maybe } from "@/types/common";

/** Runtime type guards used across the platform. */

export function isDefined<T>(value: Maybe<T>): value is T {
  return value !== null && value !== undefined;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
