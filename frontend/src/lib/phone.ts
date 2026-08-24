/**
 * E.164 phone format helpers.
 *
 * `CreateUserDto.phone` is validated by the backend with class-validator's
 * `@IsPhoneNumber()` called with no region argument, which requires a
 * `+`-prefixed E.164 string — a plain national number like "9876543210"
 * looks valid to a human but fails that validator (confirmed by the
 * backend's own `POST /users` e2e fixtures, which build `+9198...` for
 * exactly this reason). This is the one place that format is defined on the
 * frontend, so every caller of `POST /v1/users` validates and normalizes to
 * it the same way instead of re-deriving the rule.
 */

/** `+`, a non-zero leading digit, then 7–14 more digits (8–15 digits total). */
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export function isValidE164(value: string): boolean {
  return E164_PATTERN.test(value);
}

/**
 * This product's default market, not a hard restriction — the country-code
 * field stays freely editable so an international number can still be
 * entered.
 */
export const DEFAULT_PHONE_COUNTRY_CODE = "+91";
