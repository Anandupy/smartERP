import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { PrismaService } from '@/infrastructure/database/prisma.service';

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Reports whether the database is actually reachable.
 *
 * `SELECT 1` rather than a connection-pool inspection: a pooled connection can
 * look healthy while the server behind it is gone, and a readiness probe that
 * reports up in that state keeps routing traffic to an instance that cannot
 * serve it.
 */
@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  async isHealthy(
    key = 'database',
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const startedAt = Date.now();

    try {
      // The probe itself must not hang: an unbounded query against an
      // unreachable server would leave the probe pending until the client
      // times out, which reads as "no answer" rather than "unhealthy".
      await this.withTimeout(this.prisma.$queryRaw`SELECT 1`, timeoutMs);

      return indicator.up({ responseTimeMs: Date.now() - startedAt });
    } catch (error) {
      return indicator.down({
        responseTimeMs: Date.now() - startedAt,
        message:
          error instanceof Error ? error.message : 'Database unreachable',
      });
    }
  }

  private async withTimeout<T>(
    work: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        work,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(`Database check timed out after ${timeoutMs}ms`),
              ),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
