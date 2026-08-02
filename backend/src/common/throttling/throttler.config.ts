import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Named throttler buckets.
 *
 * A route selects one with `@Throttle({ [BUCKET]: {} })`; every bucket is
 * evaluated independently, so a route can carry more than one.
 */
export const THROTTLE_BUCKET = {
  /** Every public route, as a floor. */
  DEFAULT: 'default',
  /** Credential submission: login, refresh. */
  AUTH: 'auth',
  /** OTP issue and verify. */
  OTP: 'otp',
  /** Password reset request and redemption. */
  PASSWORD_RESET: 'password-reset',
} as const;

/**
 * Builds the throttler configuration from the environment.
 *
 * Storage is the package default: an in-process Map. No Redis is required or
 * used, which means limits are **per instance** — see
 * `docs/core/public-endpoint-protection.md`.
 *
 * TTLs are configured in seconds and converted here; `@nestjs/throttler` v6
 * expects milliseconds.
 */
export const buildThrottlerOptions = (
  config: ConfigService,
): ThrottlerModuleOptions => {
  const seconds = (key: string, fallback: number): number =>
    Number(config.get<number>(key) ?? fallback) * 1000;

  const count = (key: string, fallback: number): number =>
    Number(config.get<number>(key) ?? fallback);

  return {
    throttlers: [
      {
        name: THROTTLE_BUCKET.DEFAULT,
        ttl: seconds('THROTTLE_TTL', 60),
        limit: count('THROTTLE_LIMIT', 120),
      },
      {
        name: THROTTLE_BUCKET.AUTH,
        ttl: seconds('THROTTLE_AUTH_TTL', 300),
        limit: count('THROTTLE_AUTH_LIMIT', 10),
      },
      {
        name: THROTTLE_BUCKET.OTP,
        ttl: seconds('THROTTLE_OTP_TTL', 300),
        limit: count('THROTTLE_OTP_LIMIT', 5),
      },
      {
        name: THROTTLE_BUCKET.PASSWORD_RESET,
        ttl: seconds('THROTTLE_PASSWORD_RESET_TTL', 900),
        limit: count('THROTTLE_PASSWORD_RESET_LIMIT', 5),
      },
    ],
    errorMessage: 'Too many requests. Please try again later.',
  };
};
