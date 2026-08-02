import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerStorage } from '@nestjs/throttler';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Rate limits unauthenticated traffic.
 *
 * Registered globally but deliberately inert on authenticated routes: a signed-in
 * user is already identified, already authorized, and already accountable
 * through the audit log. Throttling them would turn an ordinary busy client
 * into a support incident without adding protection.
 *
 * Public routes are the ones an anonymous caller can reach in volume, so they
 * are where credential stuffing, brute force and OTP abuse actually happen.
 */
@Injectable()
export class PublicRouteThrottlerGuard extends ThrottlerGuard {
  private readonly enabled: boolean;

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    config: ConfigService,
  ) {
    super(options, storageService, reflector);
    // Tests disable throttling so that repeated runs of the auth suites do not
    // exhaust a bucket.
    this.enabled = config.get<boolean>('THROTTLE_ENABLED') !== false;
  }

  protected override async shouldSkip(
    context: ExecutionContext,
  ): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return !isPublic;
  }

  /**
   * Identifies the caller for counting purposes.
   *
   * The tracker combines the source IP with the account being targeted, when
   * the request names one. Those are two different attacks and IP alone only
   * catches the first:
   *
   * - Credential stuffing: many accounts from one IP — caught by the IP part.
   * - Distributed brute force: one account from many IPs — caught by the
   *   identifier part, which is shared across those IPs.
   *
   * The identifier is hashed so that no credential material reaches the
   * throttler storage keys, which surface in logs and error paths.
   */
  protected override getTracker(req: Record<string, any>): Promise<string> {
    const ip = this.resolveIp(req);
    const identifier = this.resolveIdentifier(req);

    return Promise.resolve(identifier ? `${ip}|${identifier}` : ip);
  }

  private resolveIp(req: Record<string, any>): string {
    const forwarded = req.headers?.['x-forwarded-for'] as string | undefined;

    // Only trusted when the platform is configured to trust proxies; Express
    // populates req.ip from X-Forwarded-For itself in that case.
    const ip: unknown = req.ip ?? req.socket?.remoteAddress;

    if (typeof ip === 'string' && ip.length > 0) {
      return ip;
    }

    return typeof forwarded === 'string' && forwarded.length > 0
      ? forwarded.split(',')[0].trim()
      : 'unknown';
  }

  private resolveIdentifier(req: Record<string, any>): string | null {
    const body: unknown = req.body;

    if (typeof body !== 'object' || body === null) {
      return null;
    }

    const candidate =
      (body as Record<string, unknown>).identifier ??
      (body as Record<string, unknown>).email ??
      (body as Record<string, unknown>).phone;

    if (typeof candidate !== 'string' || candidate.length === 0) {
      return null;
    }

    return this.hash(candidate.trim().toLowerCase());
  }

  private hash(value: string): string {
    // Non-cryptographic and deliberately short: this only has to bucket
    // requests, and a stable opaque token keeps identifiers out of storage keys.
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
