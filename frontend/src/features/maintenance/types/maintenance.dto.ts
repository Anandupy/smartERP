/**
 * Wire shapes for `/maintenance-rules`.
 *
 * Assembled from two sources, and it matters which said what:
 *
 * - The **module documentation** defines the `MaintenanceRule` table: scope,
 *   the three allow-flags, custom status and page, bypass roles, the schedule
 *   and the weekly recurrence. It also defines the one enum used here,
 *   `MaintenanceScopeType`.
 * - The **Postman collection** is the contract for requests, and its create and
 *   update bodies carry twelve further fields the documentation's table does
 *   not mention at all — the presentation set (`title`, `shortMessage`,
 *   `severity`, `bannerColor`, …).
 *
 * Both are transcribed. Nothing is inferred beyond that, and the mismatch
 * between them is reported rather than resolved by guessing. In particular:
 *
 * - **No response body is documented** for any of the five endpoints, so the
 *   read shape below is the documented table plus the request fields, with
 *   everything the table omits marked optional — a field the backend may not
 *   return must not be typed as though it always does.
 * - **`severity` has no documented value set.** The Postman sample shows
 *   `"INFO"` and nothing else, so it is typed as `string`; offering a select of
 *   invented levels would be inventing an enum.
 * - **`startAt` / `endAt` serialization is unconfirmed.** The table types them
 *   `DateTime?`; the Postman sample is a generator placeholder. ISO-8601 is
 *   what the mapper sends.
 * - **The list endpoint documents no pagination, filter or sort parameters**,
 *   so `list` takes none.
 */

/** Documented enum: the levels a rule can apply at, in precedence order. */
export const MAINTENANCE_SCOPE_TYPES = [
  "GLOBAL",
  "ORGANIZATION",
  "BRANCH",
  "MODULE",
  "FEATURE",
] as const;

export type MaintenanceScopeType = (typeof MAINTENANCE_SCOPE_TYPES)[number];

/** Documented: 0 (Sunday) to 6 (Saturday). */
export type RecurrenceDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * The presentation fields. Documented **only** in the Postman request bodies —
 * they do not appear in the module documentation's data structure table, so
 * whether the backend returns them is unknown and every one is optional here.
 */
export interface MaintenancePresentationFields {
  title?: string | null;
  shortMessage?: string | null;
  description?: string | null;
  reason?: string | null;
  estimatedCompletion?: string | null;
  maintenanceWindow?: string | null;
  supportContact?: string | null;
  bannerColor?: string | null;
  /** No documented value set; the only recorded sample is `"INFO"`. */
  severity?: string | null;
  maintenanceIcon?: string | null;
  announcementLink?: string | null;
  externalStatusPageUrl?: string | null;
}

/** The rule as read back. */
export interface MaintenanceRuleDto extends MaintenancePresentationFields {
  id: string;
  scopeType: MaintenanceScopeType;
  /** `null` for `GLOBAL`; otherwise an id, module name or feature name. */
  scopeId?: string | null;
  isActive: boolean;
  allowLogin: boolean;
  allowReadApis: boolean;
  allowWriteApis: boolean;
  customStatus: number;
  customPage?: string | null;
  /** Documented as a JSON array of role names. */
  bypassRoles?: string[] | null;
  startAt?: string | null;
  endAt?: string | null;
  timezone: string;
  isRecurring: boolean;
  recurrenceDayOfWeek?: RecurrenceDayOfWeek | null;
  /** `"HH:MM"`. */
  recurrenceStartTime?: string | null;
  recurrenceEndTime?: string | null;
}

/** Body for `POST /maintenance-rules`, exactly as the Postman request defines it. */
export interface CreateMaintenanceRuleRequest extends MaintenancePresentationFields {
  scopeType: MaintenanceScopeType;
  scopeId: string | null;
  isActive: boolean;
  allowLogin: boolean;
  allowReadApis: boolean;
  allowWriteApis: boolean;
  customStatus: number;
  customPage: string | null;
  bypassRoles: string[];
  startAt: string | null;
  endAt: string | null;
  timezone: string;
  isRecurring: boolean;
  recurrenceDayOfWeek: RecurrenceDayOfWeek | null;
  recurrenceStartTime: string | null;
  recurrenceEndTime: string | null;
}

/**
 * Body for `PATCH /maintenance-rules/:id`.
 *
 * The Postman update request sends the identical full body as create, and the
 * backend documents no partial-update rule — so the mapper always sends a
 * complete body rather than assuming a subset is accepted.
 */
export type UpdateMaintenanceRuleRequest = CreateMaintenanceRuleRequest;
