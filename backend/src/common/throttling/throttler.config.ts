import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Named throttler buckets.
 *
 * `DEFAULT` applies to every public route. A route opts into the others with
 * `@Throttle({ [BUCKET]: {} })` — only routes that select a bucket count
 * against it (see `onlyWhereSelected`); a route can select more than one.
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
 * `@nestjs/throttler` applies every named throttler to every route; a
 * `@Throttle({ [BUCKET]: {} })` decorator only overrides that bucket's
 * settings. Without this, login would also count against the OTP and
 * password-reset buckets (5 per 5–15 minutes) and lock users out long before
 * the auth limit. A named bucket therefore skips every route that does not
 * select it — the decorator always records metadata for the bucket it names,
 * even when the override object is empty.
 */
/**
 * Metadata key `@Throttle` writes per bucket (`THROTTLER:LIMIT<name>`). Not a
 * public export of `@nestjs/throttler`; the throttler unit spec applies the
 * real decorator, so a change in the library fails that test.
 */
const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMIT';

export const onlyWhereSelected =
  (bucket: string) =>
  (context: ExecutionContext): boolean => {
    const key = THROTTLER_LIMIT_KEY + bucket;
    return !(
      Reflect.hasMetadata(key, context.getHandler()) ||
      Reflect.hasMetadata(key, context.getClass())
    );
  };

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
        skipIf: onlyWhereSelected(THROTTLE_BUCKET.AUTH),
      },
      {
        name: THROTTLE_BUCKET.OTP,
        ttl: seconds('THROTTLE_OTP_TTL', 300),
        limit: count('THROTTLE_OTP_LIMIT', 5),
        skipIf: onlyWhereSelected(THROTTLE_BUCKET.OTP),
      },
      {
        name: THROTTLE_BUCKET.PASSWORD_RESET,
        ttl: seconds('THROTTLE_PASSWORD_RESET_TTL', 900),
        limit: count('THROTTLE_PASSWORD_RESET_LIMIT', 5),
        skipIf: onlyWhereSelected(THROTTLE_BUCKET.PASSWORD_RESET),
      },
    ],
    errorMessage: 'Too many requests. Please try again later.',
  };
};
