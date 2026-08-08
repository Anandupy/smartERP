/**
 * One masking implementation, used everywhere.
 *
 * Separate rules in the controller, the logger and the exporter is how a value
 * ends up masked on three screens and printed in full on the fourth. Anything
 * that renders a sensitive value calls one of these.
 */

/** `XXXX XXXX 1234` — the display form for an Aadhaar (F1 §3.4). */
export function maskAadhaar(last4: string | null | undefined): string | null {
  if (!last4) return null;
  return `XXXX XXXX ${last4.slice(-4)}`;
}

/** `••••3456` — bank accounts and anything else shown by its tail. */
export function maskTail(
  value: string | null | undefined,
  visible = 4,
): string | null {
  if (!value) return null;
  const tail = value.slice(-visible);
  return `${'•'.repeat(Math.max(0, value.length - visible))}${tail}`;
}

/** `******1234` — contact numbers. */
export function maskPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

/** `a***@example.com` — email addresses. */
export function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const at = value.indexOf('@');
  if (at <= 0) return '***';
  const local = value.slice(0, at);
  const domain = value.slice(at);
  const head = local[0] ?? '';
  return `${head}${'*'.repeat(Math.max(1, local.length - 1))}${domain}`;
}

/**
 * A value that must never be rendered at all.
 *
 * Used for key material and peppers. Returning a constant rather than a partial
 * reveal is deliberate: for a secret, even the length is information.
 */
export function redact(): string {
  return '[REDACTED]';
}
