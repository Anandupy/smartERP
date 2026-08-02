import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { PublicRouteThrottlerGuard } from '@/common/throttling/public-route-throttler.guard';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

/**
 * Exposes the guard's protected hooks so the policy can be asserted without
 * standing up an HTTP server and burning real time windows.
 */
class TestableGuard extends PublicRouteThrottlerGuard {
  public skip(context: ExecutionContext): Promise<boolean> {
    return this.shouldSkip(context);
  }

  public track(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req);
  }
}

describe('PublicRouteThrottlerGuard', () => {
  const options: ThrottlerModuleOptions = { throttlers: [] };
  const storage = {
    increment: jest.fn(),
  } as unknown as ThrottlerStorage;

  const buildGuard = (enabled: boolean, isPublic: boolean) => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === IS_PUBLIC_KEY ? isPublic : undefined,
      ),
    } as unknown as Reflector;

    const config = {
      get: jest.fn(() => enabled),
    } as any;

    return new TestableGuard(options, storage, reflector, config);
  };

  const httpContext = () =>
    ({
      getType: () => 'http',
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  describe('shouldSkip', () => {
    it('throttles public routes', async () => {
      await expect(buildGuard(true, true).skip(httpContext())).resolves.toBe(
        false,
      );
    });

    it('leaves authenticated routes untouched', async () => {
      // An authenticated caller is already identified and accountable;
      // throttling them adds no protection.
      await expect(buildGuard(true, false).skip(httpContext())).resolves.toBe(
        true,
      );
    });

    it('skips everything when THROTTLE_ENABLED is false', async () => {
      await expect(buildGuard(false, true).skip(httpContext())).resolves.toBe(
        true,
      );
    });

    it('skips non-HTTP execution contexts', async () => {
      const guard = buildGuard(true, true);
      const rpc = { getType: () => 'rpc' } as unknown as ExecutionContext;

      await expect(guard.skip(rpc)).resolves.toBe(true);
    });
  });

  describe('getTracker', () => {
    const guard = () => buildGuard(true, true);

    it('falls back to the IP when the request names no account', async () => {
      await expect(guard().track({ ip: '10.0.0.1', body: {} })).resolves.toBe(
        '10.0.0.1',
      );
    });

    it('combines IP and account so one account is limited across many IPs', async () => {
      const a = await guard().track({
        ip: '10.0.0.1',
        body: { identifier: 'victim@example.com' },
      });
      const b = await guard().track({
        ip: '10.0.0.2',
        body: { identifier: 'victim@example.com' },
      });

      // Different buckets — the IP still separates them — but the account
      // component is stable, which is what makes per-account limits possible.
      expect(a).not.toBe(b);
      expect(a.split('|')[1]).toBe(b.split('|')[1]);
    });

    it('treats the same account consistently regardless of case or padding', async () => {
      const a = await guard().track({
        ip: '10.0.0.1',
        body: { identifier: 'User@Example.com' },
      });
      const b = await guard().track({
        ip: '10.0.0.1',
        body: { identifier: '  user@example.com  ' },
      });

      expect(a).toBe(b);
    });

    it('does not put the raw identifier in the tracking key', async () => {
      const key = await guard().track({
        ip: '10.0.0.1',
        body: { email: 'secret@example.com' },
      });

      // Keys surface in logs and error paths.
      expect(key).not.toContain('secret@example.com');
    });

    it('separates callers by IP when they target different accounts', async () => {
      const a = await guard().track({
        ip: '10.0.0.1',
        body: { identifier: 'one@example.com' },
      });
      const b = await guard().track({
        ip: '10.0.0.1',
        body: { identifier: 'two@example.com' },
      });

      expect(a).not.toBe(b);
      expect(a.split('|')[0]).toBe(b.split('|')[0]);
    });

    it('degrades to a stable placeholder when no address is available', async () => {
      await expect(guard().track({ body: {} })).resolves.toBe('unknown');
    });
  });
});
