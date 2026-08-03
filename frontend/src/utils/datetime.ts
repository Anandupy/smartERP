/**
 * Time-zone helpers.
 *
 * Separate from `format.ts`, which turns values into display strings — this
 * answers "where is the operator", which is an input default rather than a
 * presentation concern.
 */

/**
 * The operator's IANA time zone, or a blank string where the runtime has none.
 *
 * Every ERP module with a timezone field wants the same default: the zone the
 * person filling the form is actually in, rather than a hard-coded one that
 * quietly makes `Asia/Kolkata` the default for a school in Manchester.
 * `Intl.DateTimeFormat` is guarded because a runtime may report no zone at all,
 * and a thrown error here would take down a form.
 */
export function resolveLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}
