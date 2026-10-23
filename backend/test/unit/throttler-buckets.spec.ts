import { ExecutionContext } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  THROTTLE_BUCKET,
  onlyWhereSelected,
} from '@/common/throttling/throttler.config';

/**
 * Named buckets must only count requests to routes that select them.
 * `@nestjs/throttler` applies every named throttler to every route by
 * default, which made login also consume the OTP and password-reset buckets
 * (5 per 5–15 minutes) and lock users out after a handful of sign-ins.
 */
class AuthControllerStub {
  @Throttle({ [THROTTLE_BUCKET.AUTH]: {} })
  login(): void {}

  @Throttle({ [THROTTLE_BUCKET.OTP]: {} })
  requestOtp(): void {}

  status(): void {}
}

@Throttle({ [THROTTLE_BUCKET.PASSWORD_RESET]: {} })
class PasswordResetControllerStub {
  reset(): void {}
}

const contextFor = (
  controller: new () => object,
  method: string,
): ExecutionContext =>
  ({
    getHandler: () =>
      (controller.prototype as Record<string, unknown>)[method] as () => void,
    getClass: () => controller,
  }) as unknown as ExecutionContext;

describe('onlyWhereSelected', () => {
  const login = contextFor(AuthControllerStub, 'login');
  const otp = contextFor(AuthControllerStub, 'requestOtp');
  const status = contextFor(AuthControllerStub, 'status');
  const reset = contextFor(PasswordResetControllerStub, 'reset');

  it('counts login against the auth bucket only', () => {
    expect(onlyWhereSelected(THROTTLE_BUCKET.AUTH)(login)).toBe(false);
    expect(onlyWhereSelected(THROTTLE_BUCKET.OTP)(login)).toBe(true);
    expect(onlyWhereSelected(THROTTLE_BUCKET.PASSWORD_RESET)(login)).toBe(true);
  });

  it('counts OTP routes against the OTP bucket only', () => {
    expect(onlyWhereSelected(THROTTLE_BUCKET.OTP)(otp)).toBe(false);
    expect(onlyWhereSelected(THROTTLE_BUCKET.AUTH)(otp)).toBe(true);
  });

  it('honours a bucket selected on the controller class', () => {
    expect(onlyWhereSelected(THROTTLE_BUCKET.PASSWORD_RESET)(reset)).toBe(
      false,
    );
  });

  it('leaves routes that select no bucket to the default floor', () => {
    for (const bucket of [
      THROTTLE_BUCKET.AUTH,
      THROTTLE_BUCKET.OTP,
      THROTTLE_BUCKET.PASSWORD_RESET,
    ]) {
      expect(onlyWhereSelected(bucket)(status)).toBe(true);
    }
  });
});
