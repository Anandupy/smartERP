import type { MaintenanceRuleFormValues } from "../schemas/maintenance-rule.schema";
import { resolveLocalTimezone } from "@/utils";

import { maintenanceRuleFormDefaults } from "../schemas/maintenance-rule.schema";
import type {
  CreateMaintenanceRuleRequest,
  MaintenanceRuleDto,
  RecurrenceDayOfWeek,
} from "../types/maintenance.dto";

/**
 * The only translation between the rule form and the wire.
 *
 * HTML controls produce strings; the documented contract wants booleans,
 * numbers, ISO timestamps and a JSON array. Doing that conversion in one place
 * is what keeps `""` from reaching the backend as a date and `"DEVOPS, SRE"`
 * from reaching it as a role.
 *
 * Two conventions, applied consistently:
 *
 * - **Empty means `null`, not `""`.** Every optional string the form leaves
 *   blank is sent as `null`, so clearing a field clears it rather than storing
 *   an empty one.
 * - **The body is always complete.** The Postman update request sends every
 *   field and the backend documents no partial update, so an edit resends the
 *   whole rule.
 */

/** `""` → `null` for optional strings. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * A `datetime-local` value (`2026-08-03T14:30`) → ISO-8601.
 *
 * The documentation types `startAt`/`endAt` as `DateTime?` but records no
 * serialization, and the Postman sample is a placeholder. ISO-8601 is what is
 * sent; if the backend expects something else this is the single line that
 * changes.
 */
function toIso(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** ISO-8601 → the `datetime-local` value an `<input>` accepts, in local time. */
function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` +
    `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  );
}

/** `"DEVOPS, SYSTEM_ADMIN"` → `["DEVOPS", "SYSTEM_ADMIN"]`. */
function toRoleList(value: string): string[] {
  return value
    .split(",")
    .map((role) => role.trim())
    .filter((role) => role.length > 0);
}

/** Seed the form from a loaded rule. */
export function toRuleFormValues(
  rule: MaintenanceRuleDto,
): MaintenanceRuleFormValues {
  return {
    ...maintenanceRuleFormDefaults(),
    scopeType: rule.scopeType,
    scopeId: rule.scopeId ?? "",
    isActive: rule.isActive,
    allowLogin: rule.allowLogin,
    allowReadApis: rule.allowReadApis,
    allowWriteApis: rule.allowWriteApis,
    customStatus: String(rule.customStatus),
    customPage: rule.customPage ?? "",
    bypassRoles: (rule.bypassRoles ?? []).join(", "),
    title: rule.title ?? "",
    shortMessage: rule.shortMessage ?? "",
    description: rule.description ?? "",
    reason: rule.reason ?? "",
    estimatedCompletion: rule.estimatedCompletion ?? "",
    maintenanceWindow: rule.maintenanceWindow ?? "",
    supportContact: rule.supportContact ?? "",
    bannerColor: rule.bannerColor ?? "",
    severity: rule.severity ?? "",
    maintenanceIcon: rule.maintenanceIcon ?? "",
    announcementLink: rule.announcementLink ?? "",
    externalStatusPageUrl: rule.externalStatusPageUrl ?? "",
    startAt: toLocalInput(rule.startAt),
    endAt: toLocalInput(rule.endAt),
    timezone: rule.timezone || resolveLocalTimezone(),
    isRecurring: rule.isRecurring,
    recurrenceDayOfWeek:
      rule.recurrenceDayOfWeek === null ||
      rule.recurrenceDayOfWeek === undefined
        ? ""
        : String(rule.recurrenceDayOfWeek),
    recurrenceStartTime: rule.recurrenceStartTime ?? "",
    recurrenceEndTime: rule.recurrenceEndTime ?? "",
  };
}

/**
 * Form values → the complete documented request body.
 *
 * Used for both create and update: Postman defines the two bodies identically.
 */
export function toRuleRequest(
  values: MaintenanceRuleFormValues,
): CreateMaintenanceRuleRequest {
  const isRecurring = values.isRecurring;

  return {
    scopeType: values.scopeType,
    // Documented as null for GLOBAL, whatever the form happens to still hold.
    scopeId: values.scopeType === "GLOBAL" ? null : optional(values.scopeId),
    isActive: values.isActive,
    allowLogin: values.allowLogin,
    allowReadApis: values.allowReadApis,
    allowWriteApis: values.allowWriteApis,
    customStatus: Number(values.customStatus),
    customPage: optional(values.customPage),
    bypassRoles: toRoleList(values.bypassRoles),
    title: optional(values.title),
    shortMessage: optional(values.shortMessage),
    description: optional(values.description),
    reason: optional(values.reason),
    estimatedCompletion: optional(values.estimatedCompletion),
    maintenanceWindow: optional(values.maintenanceWindow),
    supportContact: optional(values.supportContact),
    bannerColor: optional(values.bannerColor),
    severity: optional(values.severity),
    maintenanceIcon: optional(values.maintenanceIcon),
    announcementLink: optional(values.announcementLink),
    externalStatusPageUrl: optional(values.externalStatusPageUrl),
    startAt: toIso(values.startAt),
    endAt: toIso(values.endAt),
    timezone: values.timezone,
    isRecurring,
    // A window that is not recurring carries no recurrence, so switching it off
    // clears the three fields rather than leaving them to apply invisibly.
    recurrenceDayOfWeek: isRecurring
      ? (Number(values.recurrenceDayOfWeek) as RecurrenceDayOfWeek)
      : null,
    recurrenceStartTime: isRecurring
      ? optional(values.recurrenceStartTime)
      : null,
    recurrenceEndTime: isRecurring ? optional(values.recurrenceEndTime) : null,
  };
}
