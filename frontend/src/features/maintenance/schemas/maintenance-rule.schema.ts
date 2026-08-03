import { z } from "zod";

import { resolveLocalTimezone } from "@/utils";

import { MAINTENANCE_SCOPE_TYPES } from "../types/maintenance.dto";

/**
 * Form schema for creating and editing a maintenance rule.
 *
 * The backend documents field **types** and two enums (`scopeType`, and the
 * 0–6 range of `recurrenceDayOfWeek`); it documents no lengths, formats or
 * patterns. So this schema asserts the documented types, plus the two rules the
 * documentation states outright:
 *
 * 1. `scopeId` is null for `GLOBAL` and a target identifier for every other
 *    scope — so it is required unless the scope is `GLOBAL`.
 * 2. Weekly recurrence is driven by a day and a start/end time, so enabling
 *    `isRecurring` requires all three.
 *
 * Everything else is left to the server. A date range where the end precedes
 * the start is the one exception: it cannot be what anyone meant, and catching
 * it here costs a round trip rather than inventing policy.
 *
 * Form values are strings because HTML controls produce strings. The mapper
 * converts them to the documented wire types — that is the only place the
 * conversion happens.
 */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const maintenanceRuleFormSchema = z
  .object({
    scopeType: z.enum(MAINTENANCE_SCOPE_TYPES),
    scopeId: z.string().trim(),

    isActive: z.boolean(),
    allowLogin: z.boolean(),
    allowReadApis: z.boolean(),
    allowWriteApis: z.boolean(),

    /**
     * HTTP status the guard responds with. Documented as an `Int`, but kept a
     * string here like every other control's value — coercing in the schema
     * would split the form's input and output types and leave `watch()`
     * returning something the preview cannot render. The mapper converts it.
     */
    customStatus: z
      .string()
      .trim()
      .regex(/^\d{3}$/, "Enter a three-digit HTTP status")
      .refine((value) => Number(value) >= 100 && Number(value) <= 599, {
        message: "Not an HTTP status code",
      }),
    customPage: z.string().trim(),

    /** Comma-separated in the form; a JSON array on the wire. */
    bypassRoles: z.string().trim(),

    // Presentation set — Postman documents these as strings and nothing more.
    title: z.string().trim(),
    shortMessage: z.string().trim(),
    description: z.string().trim(),
    reason: z.string().trim(),
    estimatedCompletion: z.string().trim(),
    maintenanceWindow: z.string().trim(),
    supportContact: z.string().trim(),
    bannerColor: z.string().trim(),
    severity: z.string().trim(),
    maintenanceIcon: z.string().trim(),
    announcementLink: z.string().trim(),
    externalStatusPageUrl: z.string().trim(),

    /** `datetime-local` values; converted to ISO-8601 by the mapper. */
    startAt: z.string().trim(),
    endAt: z.string().trim(),
    timezone: z.string().trim().min(1, "Required"),

    isRecurring: z.boolean(),
    recurrenceDayOfWeek: z.string().trim(),
    recurrenceStartTime: z.string().trim(),
    recurrenceEndTime: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    if (values.scopeType !== "GLOBAL" && values.scopeId.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["scopeId"],
        message: "Required for this scope",
      });
    }

    if (values.startAt && values.endAt && values.endAt <= values.startAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "Must be after the start",
      });
    }

    if (values.isRecurring) {
      if (values.recurrenceDayOfWeek === "") {
        ctx.addIssue({
          code: "custom",
          path: ["recurrenceDayOfWeek"],
          message: "Required for a recurring window",
        });
      }
      for (const field of [
        "recurrenceStartTime",
        "recurrenceEndTime",
      ] as const) {
        if (!HHMM.test(values[field])) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "Required, as HH:MM",
          });
        }
      }
    }
  });

export type MaintenanceRuleFormValues = z.infer<
  typeof maintenanceRuleFormSchema
>;

/**
 * A blank rule.
 *
 * The three allow-flags start at the values the documentation records as the
 * backend's own defaults (`allowLogin` false, `allowReadApis` true,
 * `allowWriteApis` false) and `customStatus` at the documented example, 503 —
 * so a new rule matches what the backend would do anyway. `timezone` defaults
 * to the operator's own zone rather than a hard-coded one.
 */
export function maintenanceRuleFormDefaults(): MaintenanceRuleFormValues {
  return {
    scopeType: "GLOBAL",
    scopeId: "",
    isActive: true,
    allowLogin: false,
    allowReadApis: true,
    allowWriteApis: false,
    customStatus: "503",
    customPage: "",
    bypassRoles: "",
    title: "",
    shortMessage: "",
    description: "",
    reason: "",
    estimatedCompletion: "",
    maintenanceWindow: "",
    supportContact: "",
    bannerColor: "",
    severity: "",
    maintenanceIcon: "",
    announcementLink: "",
    externalStatusPageUrl: "",
    startAt: "",
    endAt: "",
    timezone: resolveLocalTimezone(),
    isRecurring: false,
    recurrenceDayOfWeek: "",
    recurrenceStartTime: "",
    recurrenceEndTime: "",
  };
}
