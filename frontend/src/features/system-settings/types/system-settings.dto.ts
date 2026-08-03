/**
 * Wire shapes for `/system-settings`.
 *
 * Transcribed from the backend module documentation (the `Data Structure`
 * table) and the Postman collection's request bodies — **nothing here is
 * inferred**. Fields the backend has not documented (record id, who last
 * changed the settings, when) are absent rather than optional: an optional
 * field that never arrives is indistinguishable from one that was invented.
 *
 * The documented endpoints are:
 *   GET   /system-settings        → the settings
 *   PATCH /system-settings        → update
 *   POST  /system-settings/init   → first-time initialization (once, ever)
 *
 * No response body is recorded for any of them, so `SystemSettingsDto`
 * describes the request-side contract and the documented data structure; the
 * envelope around it is the platform's (`docs/response-handling.md`).
 */

/** Deployment environments the backend accepts. Documented enum. */
export const SYSTEM_ENVIRONMENTS = ["DEV", "STAGING", "PROD"] as const;

export type SystemEnvironment = (typeof SYSTEM_ENVIRONMENTS)[number];

/** The settings record as documented. */
export interface SystemSettingsDto {
  productName: string;
  /** Unique. The backend documents no rule about changing it after init. */
  productCode: string;
  version: string;
  environment: SystemEnvironment;
  maintenanceMode: boolean;
  /** Documented as optional. */
  maintenanceMessage?: string | null;
  supportEmail: string;
  supportPhone: string;
}

/**
 * Body for `PATCH /system-settings`.
 *
 * The Postman request sends every field, and the backend documents no rule
 * about which are optional on update, so the mapper always sends a complete
 * body built from the loaded settings plus the user's edits. Guessing that a
 * partial body is accepted would be inventing contract.
 */
export type UpdateSystemSettingsRequest = SystemSettingsDto;

/** Body for `POST /system-settings/init`. Identical to the update body. */
export type InitSystemSettingsRequest = SystemSettingsDto;
