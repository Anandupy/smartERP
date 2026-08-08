import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { GovernmentIdType } from '@/generated/client';
import {
  GOVERNMENT_ID_DOMAIN,
  PHONE_DOMAIN,
  normalizeGovernmentId,
  normalizeName,
  normalizePhone,
} from './government-id';

/**
 * Deterministic blind indexes over sensitive values.
 *
 * A blind index answers "have I seen this value before?" without storing the
 * value. It has to be deterministic — a per-record salt would make equality
 * lookup impossible, which is the entire point — and it has to be *keyed*.
 *
 * Plain `SHA256(aadhaar)` is not acceptable here and the reason is arithmetic:
 * Aadhaar is twelve digits, so the whole space is under 10^12. A commodity GPU
 * enumerates that in minutes, which means an unkeyed digest is a reversible
 * encoding wearing a hash's clothing. HMAC with a deployment-held pepper makes
 * the search space depend on a secret the attacker does not have.
 *
 * The message is `organizationId : domain : normalizedValue`:
 *
 *   * **organizationId inside the message**, not merely in the query, so the
 *     same human at two tenants produces unrelated digests. Cross-tenant
 *     correlation is then impossible even for someone holding both databases.
 *   * **a domain separator**, so a phone number that happens to equal an
 *     identifier cannot collide across columns.
 *
 * ⚠️ The pepper can never change once data exists. Changing it raises no error;
 * it silently stops duplicate detection from finding anyone.
 */
@Injectable()
export class IdentityHashService implements OnModuleInit {
  private readonly logger = new Logger(IdentityHashService.name);
  private pepper?: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const configured = this.config.get<string>('IDENTITY_HASH_PEPPER');
    if (!configured) {
      this.logger.warn(
        'IDENTITY_HASH_PEPPER is not configured. Identity matching is unavailable and any operation requiring it will be refused.',
      );
      return;
    }
    this.pepper = Buffer.from(configured, 'utf8');
  }

  isConfigured(): boolean {
    return this.pepper !== undefined;
  }

  /**
   * Blind index for a government identifier.
   *
   * Normalises first, so the caller cannot accidentally index a formatted
   * value, and rejects anything that is not a valid identifier before it
   * reaches the digest.
   */
  governmentIdIndex(
    organizationId: string,
    type: GovernmentIdType,
    rawValue: string,
  ): { blindIndex: string; normalized: string } {
    const normalized = normalizeGovernmentId(type, rawValue);
    return {
      normalized,
      blindIndex: this.digest(
        organizationId,
        GOVERNMENT_ID_DOMAIN[type],
        normalized,
      ),
    };
  }

  /** Blind index for a contact number, or null when there is no usable one. */
  phoneIndex(organizationId: string, rawValue: string): string | null {
    const normalized = normalizePhone(rawValue);
    if (!normalized) return null;
    return this.digest(organizationId, PHONE_DOMAIN, normalized);
  }

  /** Case- and punctuation-insensitive name key, for low-confidence matching. */
  normalizeName(...parts: Array<string | null | undefined>): string {
    return normalizeName(...parts);
  }

  /**
   * Constant-time comparison of two digests.
   *
   * Blind indexes are compared by the database in practice, but any in-process
   * comparison uses this: a short-circuiting `===` on a secret-derived value
   * leaks its prefix through timing.
   */
  matches(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private digest(
    organizationId: string,
    domain: string,
    normalizedValue: string,
  ): string {
    if (!this.pepper) {
      throw new Error(
        'IDENTITY_HASH_PEPPER is not configured; refusing to compute a blind index',
      );
    }

    return createHmac('sha256', this.pepper)
      .update(`${organizationId}:${domain}:${normalizedValue}`, 'utf8')
      .digest('hex');
  }
}
