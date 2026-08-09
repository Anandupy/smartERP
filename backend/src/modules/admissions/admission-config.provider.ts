import { Injectable } from '@nestjs/common';

/**
 * Admission policy that genuinely varies between institutions.
 *
 * The Configuration Engine (F2) is not built. Rather than scatter
 * `process.env` reads or add settings columns to Branch — either of which would
 * have to be unpicked later — every policy read goes through this interface
 * with architectural defaults behind it. When F2 lands, the implementation is
 * swapped and no call site changes.
 *
 * The `asOf` parameter is not decoration. A policy read must answer "what was
 * the rule when this decision was made?", not "what is the rule now": an offer
 * issued under a 15-day window must not silently become a 7-day window because
 * an administrator edited the setting this morning. F2 is effective-dated for
 * exactly this reason, and taking the parameter now means the call sites are
 * already correct when it arrives.
 *
 * What is deliberately *not* here: the thirteen states, the edges between them,
 * and which transitions require a reason. Those are core semantics — see
 * §44 and `workflow.transitions.ts`.
 */
@Injectable()
export class AdmissionConfigProvider {
  /**
   * How long an offer stays open, in days.
   *
   * Fifteen days is the architectural default, not a law. An institution that
   * runs a two-week counselling round needs a different number, which is
   * precisely why this is not a constant in the workflow engine.
   */
  offerValidityDays(_scope: PolicyScope, _asOf: Date = new Date()): number {
    return 15;
  }

  /**
   * Whether an approved applicant may defer to a later cycle.
   *
   * Off by default. Deferment carries a seat into a future intake, and an
   * institution that has not decided how that interacts with its seat matrix
   * should not acquire the behaviour by accident.
   */
  defermentEnabled(_scope: PolicyScope, _asOf: Date = new Date()): boolean {
    return false;
  }
}

/**
 * Where a policy is being resolved.
 *
 * Three-tier resolution — SYSTEM → ORGANIZATION → BRANCH, most specific wins —
 * is F2's contract. The scope travels now so the eventual implementation has
 * what it needs.
 */
export interface PolicyScope {
  organizationId: string;
  branchId?: string | null;
}
