import { BadRequestException } from '@nestjs/common';
import { GovernmentIdType } from '@/generated/client';

/**
 * Canonicalisation and format validation for government identifiers.
 *
 * One normalization function, used by every caller, forever. `1234 5678 9012`
 * and `123456789012` are the same Aadhaar and must always produce the same
 * blind index — so changing this function after data exists silently stops
 * duplicate detection from finding anyone, with no error to notice.
 *
 * Format validation is not government verification. This rejects input that
 * cannot be an Aadhaar; it does not assert that the number was ever issued.
 */

/** The blind-index domain separator, so a phone equal to an id cannot collide. */
export const GOVERNMENT_ID_DOMAIN: Record<GovernmentIdType, string> = {
  AADHAAR: 'aadhaar',
};

export const PHONE_DOMAIN = 'phone';

/**
 * Canonicalise, or reject.
 *
 * Deliberately strict rather than forgiving: silently normalising arbitrary
 * garbage into a valid-looking identifier is how a typo becomes a permanent,
 * confidently-wrong identity record.
 */
export function normalizeGovernmentId(
  type: GovernmentIdType,
  raw: string,
): string {
  if (typeof raw !== 'string') {
    throw new BadRequestException({
      error: 'GOVERNMENT_ID_INVALID',
      message: 'The supplied government identifier is not valid.',
    });
  }

  switch (type) {
    case GovernmentIdType.AADHAAR:
      return normalizeAadhaar(raw);
    default:
      throw new BadRequestException({
        error: 'GOVERNMENT_ID_TYPE_UNSUPPORTED',
        message: 'That government identifier type is not supported.',
      });
  }
}

/**
 * Aadhaar: strip separators, then require exactly twelve digits not starting
 * with 0 or 1 — UIDAI never issues a number beginning with either.
 *
 * The Verhoeff checksum is deliberately not enforced. It would catch more typos,
 * but a checksum failure and a genuinely unusual number are indistinguishable to
 * the clerk in front of the parent, and rejecting a real Aadhaar at the counter
 * is worse than storing one that a later verification step will question.
 */
function normalizeAadhaar(raw: string): string {
  const stripped = raw.replace(/[\s-]/g, '');

  if (!/^\d{12}$/.test(stripped)) {
    throw new BadRequestException({
      error: 'GOVERNMENT_ID_INVALID',
      // Never echoes the value back: an error message is not the place to
      // repeat an identifier, and the caller already knows what it sent.
      message: 'The supplied government identifier is not valid.',
    });
  }

  if (/^[01]/.test(stripped)) {
    throw new BadRequestException({
      error: 'GOVERNMENT_ID_INVALID',
      message: 'The supplied government identifier is not valid.',
    });
  }

  return stripped;
}

/**
 * Contact numbers: digits only, last ten.
 *
 * Country codes and formatting vary per source, so `+91 98765 43210`,
 * `098765 43210` and `9876543210` all have to reach the same digest.
 */
export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/**
 * Names, for low-confidence matching only.
 *
 * Never rendered to a user — the display name lives on the record that owns it.
 */
export function normalizeName(
  ...parts: Array<string | null | undefined>
): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(' ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The last four digits, for display without decryption. */
export function lastFour(normalized: string): string {
  return normalized.slice(-4);
}
