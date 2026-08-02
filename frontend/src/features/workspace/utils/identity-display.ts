/**
 * Display helpers for a person's name.
 *
 * Presentation only — nothing here decides anything, and none of it is sent
 * back to the backend. Every function is total and tolerates the empty string,
 * because `/auth/me` may omit `fullName` entirely.
 */

/** Split on any run of whitespace, dropping empties. */
function parts(name: string): string[] {
  return name.trim().split(/\s+/).filter(Boolean);
}

/**
 * The name to greet someone by.
 *
 * Falls back to the whole string, then to `null` — a greeting with a blank in
 * it reads worse than no greeting at all, so the caller can drop it entirely.
 */
export function firstNameOf(name: string | null | undefined): string | null {
  if (!name) return null;
  return parts(name)[0] ?? null;
}

/**
 * Up to two initials for an avatar fallback.
 *
 * Uses the first and last parts rather than the first two, so "Amaan Kabir
 * Sheikh" reads as "AS" — the pair people recognize themselves by.
 */
export function initialsOf(name: string | null | undefined): string {
  const segments = parts(name ?? "");
  if (segments.length === 0) return "";
  const first = segments[0]?.[0] ?? "";
  const last = segments.length > 1 ? (segments.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * A role code as a human label: `SUPER_ADMIN` → `Super admin`.
 *
 * Sentence case, not title case: the backend's codes are not proper nouns, and
 * shouting "SUPER ADMIN" at someone in a badge is noise rather than emphasis.
 */
export function roleLabelOf(role: string | null | undefined): string | null {
  if (!role) return null;
  const words = role
    .trim()
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean);
  if (words.length === 0) return null;
  return words
    .map((word, index) =>
      index === 0 ? word[0].toUpperCase() + word.slice(1) : word,
    )
    .join(" ");
}
