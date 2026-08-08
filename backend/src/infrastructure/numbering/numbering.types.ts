import {
  AllocationMode,
  ResetStrategy,
  SequencePurpose,
  SequenceScope,
} from '@/generated/client';

export { AllocationMode, ResetStrategy, SequencePurpose, SequenceScope };

/**
 * What a caller must state to allocate a number.
 *
 * `branchId` and `academicYearId` are optional because whether they are needed
 * is a property of the *sequence*, not of the caller: an ORGANIZATION-scoped
 * purpose ignores the branch, and a `NEVER`-reset purpose ignores the year.
 * Supplying them anyway is harmless; omitting one a sequence needs is an error.
 */
export interface AllocateNumberParams {
  purpose: SequencePurpose;
  organizationId: string;
  branchId?: string | null;
  academicYearId?: string | null;
}

/**
 * The scope and reset behaviour every purpose is provisioned with.
 *
 * Held in code rather than left to whoever creates the config, because these
 * are not institutional preferences. Whether a receipt series may contain a gap
 * is a statutory question, and whether a student code survives a branch
 * transfer is an identity invariant — neither is a per-tenant choice.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §34.3.
 */
export const SEQUENCE_PURPOSE_RULES: Record<
  SequencePurpose,
  {
    scope: SequenceScope;
    resetStrategy: ResetStrategy;
    allocationMode: AllocationMode;
  }
> = {
  STUDENT_CODE: {
    scope: 'ORGANIZATION',
    resetStrategy: 'NEVER',
    allocationMode: 'MONOTONIC',
  },
  EMPLOYEE_CODE: {
    scope: 'ORGANIZATION',
    resetStrategy: 'NEVER',
    allocationMode: 'MONOTONIC',
  },
  ADMISSION_NO: {
    scope: 'BRANCH',
    resetStrategy: 'YEARLY',
    allocationMode: 'MONOTONIC',
  },
  ADMISSION_FORM: {
    scope: 'BRANCH',
    resetStrategy: 'YEARLY',
    allocationMode: 'MONOTONIC',
  },
  APPLICATION: {
    scope: 'BRANCH',
    resetStrategy: 'YEARLY',
    allocationMode: 'MONOTONIC',
  },
  RECEIPT: {
    scope: 'BRANCH',
    resetStrategy: 'YEARLY',
    allocationMode: 'GAPLESS',
  },
  INVOICE: {
    scope: 'BRANCH',
    resetStrategy: 'YEARLY',
    allocationMode: 'GAPLESS',
  },
  TC_NUMBER: {
    scope: 'BRANCH',
    resetStrategy: 'YEARLY',
    allocationMode: 'GAPLESS',
  },
  CERTIFICATE: {
    scope: 'BRANCH',
    resetStrategy: 'YEARLY',
    allocationMode: 'MONOTONIC',
  },
};

/**
 * The sentinel a null academic year coalesces to.
 *
 * Postgres treats NULLs as distinct in a unique index, so a plain
 * `UNIQUE (configId, academicYearId)` does not constrain `NEVER`-reset
 * counters at all — every allocation would insert a fresh counter returning 1.
 * The uniqueness rule is therefore a functional index over this coalesced
 * value, and the `ON CONFLICT` target must name the identical expression.
 *
 * Changing this string means rebuilding the index. It is not configuration.
 */
export const NULL_ACADEMIC_YEAR_SENTINEL =
  '00000000-0000-0000-0000-000000000000';

/** A format that renders no counter renders the same value every time. */
export const SEQUENCE_PLACEHOLDER = '{sequence}';
