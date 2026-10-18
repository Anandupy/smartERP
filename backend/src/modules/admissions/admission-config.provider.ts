import { Injectable } from '@nestjs/common';
import {
  ADMISSION_CONFIG_KEYS,
  AdmissionWorkflowProfile,
} from '@/modules/configuration/config.registry';
import {
  ConfigSource,
  ConfigurationService,
} from '@/modules/configuration/configuration.service';

/**
 * Admission policy that genuinely varies between institutions, resolved
 * through the F2 configuration engine — SYSTEM → ORGANIZATION → BRANCH, most
 * specific wins, effective-dated.
 *
 * The `asOf` parameter is not decoration. A policy read must answer "what was
 * the rule when this decision was made?", not "what is the rule now": an
 * application that entered the workflow under one profile finishes under it,
 * and an offer issued under a 15-day window keeps that deadline after an
 * administrator shortens the window. `WorkflowService` passes the
 * application's `submittedAt` (or now, for a draft).
 *
 * What is deliberately *not* here: the thirteen states, the edges between
 * them, and which transitions require a reason. Those are core semantics —
 * see §44 and `workflow.transitions.ts`. A profile chooses a journey over the
 * one machine; it never redraws it.
 */
@Injectable()
export class AdmissionConfigProvider {
  constructor(private readonly configuration: ConfigurationService) {}

  /** Every admission policy value for one scope and instant, in one read. */
  async policy(
    scope: PolicyScope,
    asOf: Date = new Date(),
  ): Promise<AdmissionPolicy> {
    const resolved = await this.configuration.resolveMany(
      Object.values(ADMISSION_CONFIG_KEYS),
      scope,
      asOf,
    );

    const value = <T>(key: string) => resolved.get(key)!.value as T;
    const sources = Object.fromEntries(
      Object.entries(ADMISSION_CONFIG_KEYS).map(([name, key]) => [
        name,
        resolved.get(key)!.source,
      ]),
    ) as Record<keyof typeof ADMISSION_CONFIG_KEYS, ConfigSource>;

    return {
      workflowProfile: value<AdmissionWorkflowProfile>(
        ADMISSION_CONFIG_KEYS.workflowProfile,
      ),
      offerValidityDays: value<number>(ADMISSION_CONFIG_KEYS.offerValidityDays),
      allowDeferment: value<boolean>(ADMISSION_CONFIG_KEYS.allowDeferment),
      waitlistEnabled: value<boolean>(ADMISSION_CONFIG_KEYS.waitlistEnabled),
      feeStepEnabled: value<boolean>(ADMISSION_CONFIG_KEYS.feeStepEnabled),
      documentRequestEnabled: value<boolean>(
        ADMISSION_CONFIG_KEYS.documentRequestEnabled,
      ),
      sources,
      asOf,
    };
  }

  /**
   * How long an offer stays open, in days.
   *
   * Fifteen days is the registry default, not a law. An institution that runs
   * a two-week counselling round sets its own.
   */
  async offerValidityDays(
    scope: PolicyScope,
    asOf: Date = new Date(),
  ): Promise<number> {
    return (await this.policy(scope, asOf)).offerValidityDays;
  }

  /**
   * Whether an approved applicant may defer to a later cycle.
   *
   * Off by default. Deferment carries a seat into a future intake, and an
   * institution that has not decided how that interacts with its seat matrix
   * should not acquire the behaviour by accident.
   */
  async defermentEnabled(
    scope: PolicyScope,
    asOf: Date = new Date(),
  ): Promise<boolean> {
    return (await this.policy(scope, asOf)).allowDeferment;
  }
}

export interface AdmissionPolicy {
  workflowProfile: AdmissionWorkflowProfile;
  offerValidityDays: number;
  allowDeferment: boolean;
  waitlistEnabled: boolean;
  feeStepEnabled: boolean;
  documentRequestEnabled: boolean;
  /** Which tier answered each value. */
  sources: Record<keyof typeof ADMISSION_CONFIG_KEYS, ConfigSource>;
  /** The instant the policy was resolved for. */
  asOf: Date;
}

/** Where a policy is being resolved. */
export interface PolicyScope {
  organizationId: string;
  branchId?: string | null;
}
