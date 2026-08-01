/**
 * Password policy and strength scoring.
 *
 * The rules are the ones the UI advertises, so the checklist, the meter, and
 * the Zod schema all read from this single source rather than restating the
 * policy three times. The backend remains the authority — this only shapes what
 * the user sees first.
 */

export interface PasswordRule {
  id: string;
  /** Shown in the requirements checklist. */
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = Object.freeze([
  {
    id: "length",
    label: "At least 12 characters",
    test: (password) => password.length >= 12,
  },
  {
    id: "uppercase",
    label: "At least one uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "At least one lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "At least one number",
    test: (password) => /\d/.test(password),
  },
  {
    id: "symbol",
    label: "At least one special character (!@#$%)",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
]);

export type PasswordStrengthLevel =
  "empty" | "weak" | "fair" | "good" | "strong";

export interface PasswordStrength {
  /** How many rules the password satisfies. */
  satisfied: number;
  /** Total number of rules. */
  total: number;
  /** Completion percentage (0–100) for a determinate meter. */
  score: number;
  level: PasswordStrengthLevel;
  /** Display-ready label for the level. */
  label: string;
  /** Per-rule pass/fail, in policy order, for the checklist. */
  results: { id: string; label: string; satisfied: boolean }[];
  /** `true` when every rule passes. */
  meetsPolicy: boolean;
}

const LEVEL_LABELS: Record<PasswordStrengthLevel, string> = {
  empty: "Enter a password",
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

function levelFor(satisfied: number, total: number): PasswordStrengthLevel {
  if (satisfied === 0) return "empty";
  if (satisfied === total) return "strong";
  const ratio = satisfied / total;
  if (ratio < 0.5) return "weak";
  if (ratio < 0.8) return "fair";
  return "good";
}

/** Evaluate a password against {@link PASSWORD_RULES}. */
export function getPasswordStrength(password: string): PasswordStrength {
  const results = PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    satisfied: rule.test(password),
  }));

  const satisfied = results.filter((result) => result.satisfied).length;
  const total = PASSWORD_RULES.length;
  const level = password.length === 0 ? "empty" : levelFor(satisfied, total);

  return {
    satisfied,
    total,
    score: Math.round((satisfied / total) * 100),
    level,
    label: LEVEL_LABELS[level],
    results,
    meetsPolicy: satisfied === total,
  };
}
