/**
 * Wire shapes for `/communication/settings`.
 *
 * Both `GET` and `PATCH` are documented with `organizationId`/`branchId` as
 * **query parameters**, not body or path — the settings record is addressed
 * by scope, not by id. The spec (§2D) notes `GET` returns documented
 * *defaults* rather than a `404` when nothing has been saved for a scope yet,
 * so this module never shows a "not configured" error for settings.
 *
 * The update body is documented as the twelve writable fields — eight
 * booleans plus four provider selections — and no partial-update rule is
 * stated, so `communication.mapper`'s update always rebuilds the complete body
 * from the loaded record plus the user's edits.
 */

/** The ten documented `ProviderType` values. Only `SMTP` has a real backend implementation. */
export const PROVIDER_TYPES = [
  "SMTP",
  "AWS_SES",
  "RESEND",
  "MAILGUN",
  "POSTMARK",
  "TWILIO",
  "MSG91",
  "META_WHATSAPP",
  "FIREBASE_FCM",
  "CUSTOM",
] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export interface CommunicationSettingsQuery {
  organizationId?: string;
  branchId?: string;
}

/** The settings record for one organization/branch scope. */
export interface CommunicationSettingsDto {
  id?: string;
  organizationId?: string | null;
  branchId?: string | null;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
  pushEnabled?: boolean;
  otpEnabled?: boolean;
  trackingEnabled?: boolean;
  analyticsEnabled?: boolean;
  retryEnabled?: boolean;
  defaultEmailProvider?: ProviderType | string;
  defaultSmsProvider?: ProviderType | string;
  defaultWhatsappProvider?: ProviderType | string;
  defaultPushProvider?: ProviderType | string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Body for `PATCH /communication/settings?organizationId=&branchId=` — the twelve documented fields. */
export interface CommunicationSettingsWriteRequest {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  pushEnabled: boolean;
  otpEnabled: boolean;
  trackingEnabled: boolean;
  analyticsEnabled: boolean;
  retryEnabled: boolean;
  defaultEmailProvider: string;
  defaultSmsProvider: string;
  defaultWhatsappProvider: string;
  defaultPushProvider: string;
}
