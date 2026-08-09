import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { WorkflowService } from './workflow.service';
import { WorkflowAction } from './workflow.transitions';

/**
 * Cancels offers nobody took up.
 *
 * The important property is what it does **not** do: it never writes
 * `admissionStatus`. It calls the same `WorkflowService.transition` a registrar
 * calls, so an expiry is locked, state-checked, historised and evented exactly
 * like a human action. A job that updated the column directly would be the one
 * state change in the system with no audit trail and no history row — and the
 * one that could produce a state the machine says is impossible.
 *
 * Expiry lands on `CANCELLED`, not `REJECTED` or `WITHDRAWN`. The institution
 * did not refuse the candidate and the candidate did not walk away; the offer
 * simply lapsed, and conflating that with either of the other two would corrupt
 * every conversion report built on top of it.
 *
 * Uses the same `OnApplicationBootstrap` + interval shape as `OutboxRelay`,
 * which is this repository's scheduling mechanism. No queue framework is
 * introduced for one sweep.
 */
@Injectable()
export class OfferExpiryJob
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OfferExpiryJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  /**
   * Hourly. An offer window is measured in days, so a sweep that runs within an
   * hour of the deadline is precise enough — and the seat-confirmation guard
   * reads the deadline under its own lock, so an offer is unusable the instant
   * it lapses regardless of when the sweep next runs. The job tidies state; it
   * is not what enforces the deadline.
   */
  private readonly intervalMs = 60 * 60 * 1000;

  /** Bounded so one pass cannot hold a connection open indefinitely. */
  private readonly batchSize = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.OFFER_EXPIRY_JOB_DISABLED === 'true') {
      this.logger.warn(
        'Offer expiry sweep is disabled. Lapsed offers will remain APPROVED until it is re-enabled.',
      );
      return;
    }
    this.timer = setInterval(() => void this.sweep(), this.intervalMs);
    this.timer.unref?.();
    this.logger.log(
      `Offer expiry sweep running every ${this.intervalMs / 60000} minutes.`,
    );
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Expire everything currently past its deadline.
   *
   * Each candidate is an independent transaction. A run that fails at the
   * fortieth applicant leaves the first thirty-nine correctly cancelled and the
   * rest still discoverable by the next pass — which is the behaviour that
   * makes a partial failure safe rather than a state to reconcile by hand.
   *
   * Returns per-candidate outcomes rather than throwing: a race lost to a
   * registrar confirming the seat is the expected result, not an error.
   */
  async sweep(now: Date = new Date()): Promise<{
    examined: number;
    expired: number;
    skipped: number;
    failed: number;
  }> {
    if (this.running || this.stopped) {
      return { examined: 0, expired: 0, skipped: 0, failed: 0 };
    }
    this.running = true;

    let examined = 0;
    let expired = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const candidates = await this.prisma.applicant.findMany({
        where: {
          admissionStatus: 'APPROVED',
          offerExpiresAt: { lt: now },
          deletedAt: null,
        },
        select: {
          id: true,
          organizationId: true,
          branchId: true,
          academicYearId: true,
        },
        take: this.batchSize,
      });

      examined = candidates.length;

      for (const candidate of candidates) {
        try {
          await this.workflow.transition(
            candidate.id,
            {
              action: WorkflowAction.EXPIRE_OFFER,
              remarks: 'Offer lapsed without seat confirmation.',
            },
            {
              organizationId: candidate.organizationId,
              branchId: candidate.branchId,
              academicYearId: candidate.academicYearId,
            },
            { system: true },
          );
          expired += 1;
        } catch (error) {
          // The candidate list is a snapshot. By the time this row is reached
          // a registrar may have confirmed the seat, or another worker may have
          // expired it — both leave the row in a state the rule refuses, and
          // both are correct outcomes. The row lock decided; this did not.
          if (this.isExpectedRace(error)) {
            skipped += 1;
            continue;
          }
          failed += 1;
          this.logger.error(
            `Offer expiry failed for applicant ${candidate.id}: ${
              error instanceof Error ? error.message : 'unknown'
            }`,
          );
        }
      }

      if (expired > 0 || failed > 0) {
        this.logger.log(
          `Offer expiry sweep: ${expired} expired, ${skipped} already moved on, ${failed} failed, of ${examined} examined.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Offer expiry sweep failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }

    return { examined, expired, skipped, failed };
  }

  private isExpectedRace(error: unknown): boolean {
    const code = (error as { response?: { error?: string } })?.response?.error;
    return code === 'INVALID_TRANSITION' || code === 'OFFER_NOT_EXPIRED';
  }
}
