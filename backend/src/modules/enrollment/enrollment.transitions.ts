import { EnrollmentStatus as S } from '@/generated/client';

/**
 * The placement lifecycle, as data.
 *
 * Small enough that a conditional would work today and wrong for the same
 * reason the applicant machine is table-driven: promotion, repeat and bulk
 * promotion each add edges, and the fourth author to add one will not
 * rediscover the rule that a closed placement never reopens.
 *
 * There is no `PATCH /enrollments/:id { status }`. Every edge below belongs to
 * a named operation, and the ones Phase 4 does not build have no operation to
 * reach them yet — which is why the table is consulted but only three of its
 * edges are currently reachable.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §18.
 */

/** Placements that are history. Nothing leads out of them. */
export const TERMINAL_STATUSES: readonly S[] = [
  S.PROMOTED,
  S.DETAINED,
  S.COMPLETED,
  S.TRANSFERRED,
  S.DROPPED_OUT,
  S.CANCELLED,
  S.SUPERSEDED,
];

/**
 * Every legal edge.
 *
 * A correction does **not** appear as an edge into `ACTIVE`: correcting a
 * placement writes a *new* row and closes the old one as `SUPERSEDED`. There is
 * deliberately no path back from any terminal state, so a mistake can only ever
 * be put right by a row that leaves both versions visible.
 */
const EDGES: ReadonlyArray<{ from: S; to: readonly S[] }> = [
  { from: S.PENDING, to: [S.ACTIVE, S.CANCELLED, S.SUPERSEDED] },
  {
    from: S.ACTIVE,
    to: [
      S.ON_BREAK,
      S.PROMOTED,
      S.DETAINED,
      S.COMPLETED,
      S.TRANSFERRED,
      S.DROPPED_OUT,
      S.CANCELLED,
      S.SUPERSEDED,
    ],
  },
  // A year off resumes, or ends the way any other placement ends.
  {
    from: S.ON_BREAK,
    to: [
      S.ACTIVE,
      S.PROMOTED,
      S.DETAINED,
      S.COMPLETED,
      S.DROPPED_OUT,
      S.CANCELLED,
      S.SUPERSEDED,
    ],
  },
];

const BY_FROM = new Map<S, readonly S[]>(EDGES.map((e) => [e.from, e.to]));

/** The statuses a placement may move to from where it is now. */
export function nextStatuses(from: S): readonly S[] {
  return BY_FROM.get(from) ?? [];
}

export function isLegalTransition(from: S, to: S): boolean {
  return nextStatuses(from).includes(to);
}

/**
 * Whether the placement is still live.
 *
 * The question `correct`, `transfer` and `cancel` all ask before they touch
 * anything: a historical row is evidence and is never rewritten.
 */
export function isOpen(status: S): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

/**
 * Statuses with no outbound edge.
 *
 * Computed rather than listed so the exhaustiveness test compares the table
 * against the enum, not against a second hand-written list that could drift.
 */
export function statusesWithNoExit(): S[] {
  return Object.values(S).filter((status) => nextStatuses(status).length === 0);
}
