import { ConfigScope, ConfigValueType } from '@/generated/client';
import { PERMISSIONS } from '@/common/constants/permission.constants';

/**
 * The typed key registry (F2 D1, D8).
 *
 * Every key that can be stored is declared here, next to the code that reads
 * it, with its type, default, permitted scopes and validator. Nothing else can
 * be set: the API refuses unknown keys, and `ConfigDefinition` rows are written
 * from this list rather than created by a caller — a key nobody reads is a
 * note, not configuration.
 *
 * See docs/planning/00-foundation/02-configuration.md.
 */
export interface ConfigDefinitionSpec<T = unknown> {
  key: string;
  /** Groups keys for the UI and decides the write permission (F2 Q2). */
  category: 'ADMISSIONS';
  valueType: ConfigValueType;
  /** The answer when no scope has set a value. Never null. */
  defaultValue: T;
  allowedScopes: ConfigScope[];
  /** Versioned keys are policy evidence: every change needs a reason. */
  isVersioned: boolean;
  description: string;
  /** Allowed values, for an ENUM key. */
  enumValues?: readonly string[];
  /**
   * Narrow an untrusted value to `T`, or return the reason it is not one.
   *
   * Used on every write *and* on every read: a stored row that fails it is
   * refused rather than trusted, so a corrupted value can never silently
   * select a more permissive workflow.
   */
  validate(
    value: unknown,
  ): { ok: true; value: T } | { ok: false; reason: string };
}

/** The permission that may change a key of each category. */
export const CONFIG_WRITE_PERMISSION: Record<
  ConfigDefinitionSpec['category'],
  string
> = {
  ADMISSIONS: PERMISSIONS.Config.AdmissionsWrite,
};

const ALL_SCOPES: ConfigScope[] = [
  ConfigScope.SYSTEM,
  ConfigScope.ORGANIZATION,
  ConfigScope.BRANCH,
];

function booleanKey(
  key: string,
  defaultValue: boolean,
  description: string,
): ConfigDefinitionSpec<boolean> {
  return {
    key,
    category: 'ADMISSIONS',
    valueType: ConfigValueType.BOOLEAN,
    defaultValue,
    allowedScopes: ALL_SCOPES,
    isVersioned: true,
    description,
    validate: (value) =>
      typeof value === 'boolean'
        ? { ok: true, value }
        : { ok: false, reason: 'must be true or false' },
  };
}

/**
 * The admission workflow profiles.
 *
 * A profile chooses a *journey* over the one, unchanged thirteen-state
 * machine; it never adds a state or an edge. See
 * docs/planning/configurable-admission-workflow-research.md §10.
 */
export const ADMISSION_WORKFLOW_PROFILES = [
  'SIMPLE_ADMISSION',
  'STANDARD_ADMISSION',
  'VERIFIED_ADMISSION',
] as const;

export type AdmissionWorkflowProfile =
  (typeof ADMISSION_WORKFLOW_PROFILES)[number];

export const ADMISSION_CONFIG_KEYS = {
  workflowProfile: 'admissions.workflow_profile',
  offerValidityDays: 'admissions.offer_validity_days',
  allowDeferment: 'admissions.allow_deferment',
  waitlistEnabled: 'admissions.waitlist_enabled',
  feeStepEnabled: 'admissions.fee_step_enabled',
  documentRequestEnabled: 'admissions.document_request_enabled',
} as const;

/**
 * Every registered key.
 *
 * The defaults reproduce the behaviour that shipped before this registry
 * existed, exactly: a 15-day offer, deferment off, and the waitlist, fee and
 * document-request steps all available. An organization that never touches
 * configuration notices nothing.
 */
export const CONFIG_DEFINITIONS: readonly ConfigDefinitionSpec[] = [
  {
    key: ADMISSION_CONFIG_KEYS.workflowProfile,
    category: 'ADMISSIONS',
    valueType: ConfigValueType.ENUM,
    defaultValue: 'STANDARD_ADMISSION',
    allowedScopes: ALL_SCOPES,
    isVersioned: true,
    enumValues: ADMISSION_WORKFLOW_PROFILES,
    description:
      'Which admission journey the institution follows: SIMPLE_ADMISSION (direct admission in one step), STANDARD_ADMISSION (submit, review, offer, seat confirmation, admit) or VERIFIED_ADMISSION (standard, plus documents before review and a separate approver).',
    validate: (value) =>
      typeof value === 'string' &&
      (ADMISSION_WORKFLOW_PROFILES as readonly string[]).includes(value)
        ? { ok: true, value }
        : {
            ok: false,
            reason: `must be one of ${ADMISSION_WORKFLOW_PROFILES.join(', ')}`,
          },
  } satisfies ConfigDefinitionSpec<string>,
  {
    key: ADMISSION_CONFIG_KEYS.offerValidityDays,
    category: 'ADMISSIONS',
    valueType: ConfigValueType.INT,
    defaultValue: 15,
    allowedScopes: ALL_SCOPES,
    isVersioned: true,
    description:
      'How many days an admission offer stays open before the expiry sweep cancels it. An offer keeps the deadline it was issued with.',
    validate: (value) =>
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 365
        ? { ok: true, value }
        : { ok: false, reason: 'must be a whole number of days from 1 to 365' },
  } satisfies ConfigDefinitionSpec<number>,
  booleanKey(
    ADMISSION_CONFIG_KEYS.allowDeferment,
    false,
    'Whether an approved applicant may defer to a later intake.',
  ),
  booleanKey(
    ADMISSION_CONFIG_KEYS.waitlistEnabled,
    true,
    'Whether an application under review may be waitlisted.',
  ),
  booleanKey(
    ADMISSION_CONFIG_KEYS.feeStepEnabled,
    true,
    'Whether an application under review may be moved to the fee-pending step.',
  ),
  booleanKey(
    ADMISSION_CONFIG_KEYS.documentRequestEnabled,
    true,
    'Whether reviewers may send an application back for documents.',
  ),
];

const BY_KEY = new Map(CONFIG_DEFINITIONS.map((d) => [d.key, d]));

export function findDefinition(key: string): ConfigDefinitionSpec | undefined {
  return BY_KEY.get(key);
}
