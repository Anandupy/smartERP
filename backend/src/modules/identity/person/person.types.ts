import { GovernmentIdType } from '@/generated/client';

/**
 * How strongly two records are believed to describe the same human.
 *
 * A TypeScript enum rather than a database one, because nothing persists it:
 * confidence is computed per query from whichever signals happened to agree.
 * Declaring it in the schema would create a type the database stores nowhere.
 *
 * `HIGH` never reaches a caller as a warning — a deterministic identifier match
 * means `resolve()` has already returned the existing Person, and presenting
 * that as something to review is how staff learn to dismiss warnings.
 */
export enum MatchConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/**
 * What a caller knows about a human when asking the identity index to place
 * them.
 *
 * Only `dob` and a name are required. A government identifier is optional
 * because a child is routinely admitted before one exists, and forcing it would
 * either block the admission or invite a fabricated value.
 */
export interface PersonIdentifiers {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dob: Date;
  phone?: string | null;
  governmentIdType?: GovernmentIdType;
  governmentId?: string | null;
}

/** A possible same-human match, for a person to review. */
export interface ScoredMatch {
  personId: string;
  confidence: MatchConfidence;
  /** Which signals agreed. Never the values themselves. */
  matchedOn: string[];
}

/**
 * The result of placing someone in the identity index.
 *
 * `warnings` never blocks. Twins share an address, a phone, a date of birth and
 * their parents; blocking on that rejects valid applicants, so candidates are
 * returned alongside a usable Person rather than instead of one.
 */
export interface ResolvedPerson {
  personId: string;
  /** True when this call created the row rather than finding it. */
  created: boolean;
  /** True when a government identifier matched deterministically. */
  matchedByGovernmentId: boolean;
  warnings: ScoredMatch[];
}
