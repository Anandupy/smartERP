import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RowLockService } from '@/infrastructure/database/row-lock.service';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { AdmissionWorkflowTransitionedEvent } from '@/common/events';
import { ResourceScope, scopedWhere } from '@/common/scope/resource-scope';
import { AdmissionApplicationStatus } from '@/generated/client';
import { TransitionDto } from './dto/workflow.dto';

type Status = AdmissionApplicationStatus;

/**
 * The applicant state machine.
 *
 * PHASE 0 SCOPE. The transition graph itself is unchanged — the offer →
 * confirm → admit path (`APPROVED → SEAT_CONFIRMED → ADMITTED`), deferment and
 * applicant-initiated withdrawal are Phase 3, and their states are deliberately
 * unreachable until the operations that own them exist.
 *
 * What Phase 0 changes is everything around the graph:
 *
 *   * the status column is an enum, so a direct write cannot invent a state;
 *   * the applicant is looked up **within the caller's scope**, so a transition
 *     cannot be applied to another tenant's or branch's record;
 *   * the row is **locked** before its state is read, so two administrators
 *     approving at the same moment no longer both pass the guard;
 *   * the event is written to the outbox inside the transaction, so a crash
 *     after COMMIT cannot lose it.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §17.
 */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLock: RowLockService,
    private readonly outbox: OutboxPublisher,
  ) {}

  /**
   * Legal transitions.
   *
   * `SEAT_CONFIRMED`, `DEFERRED`, `WITHDRAWN` and `ADMITTED` exist in the enum
   * but have no inbound edge yet. That is intentional: `ADMITTED` may only ever
   * be reached through `admit()` (Phase 5), which writes a Student, an
   * Admission and an Enrollment in the same transaction. Allowing a bare status
   * transition into it would produce an applicant marked admitted with no
   * student behind it — the exact ghost this design exists to prevent.
   */
  private readonly VALID_TRANSITIONS: Record<Status, Status[]> = {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['UNDER_REVIEW', 'CANCELLED', 'REJECTED'],
    UNDER_REVIEW: [
      'DOCUMENT_PENDING',
      'FEE_PENDING',
      'WAITLISTED',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
    ],
    DOCUMENT_PENDING: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
    FEE_PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
    WAITLISTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
    // Opened in Phase 3, when SEAT_CONFIRMED and DEFERRED acquire operations.
    APPROVED: [],
    SEAT_CONFIRMED: [],
    DEFERRED: [],
    ADMITTED: [],
    REJECTED: [],
    WITHDRAWN: [],
    CANCELLED: [],
  };

  async transitionState(
    applicantId: string,
    dto: TransitionDto,
    scope: ResourceScope,
    userId?: string,
  ) {
    const { updated, oldStatus } = await this.prisma.$transaction(
      async (tx) => {
        // Lock first, read state second. `findUnique` takes no lock, so two
        // concurrent approvals would both read UNDER_REVIEW and both pass.
        // Under READ COMMITTED, FOR UPDATE re-evaluates the row after the
        // blocking transaction commits, so the loser sees the new state.
        const locked = await this.rowLock.lockRow(tx, {
          table: 'Applicant',
          id: applicantId,
          scope: {
            organizationId: scope.organizationId,
            branchId: scope.branchId,
          },
          columns: ['admissionStatus', 'deletedAt'],
        });

        if (!locked || locked.deletedAt !== null) {
          throw new NotFoundException('Applicant not found');
        }

        const currentStatus = locked.admissionStatus as Status;
        const targetStatus = dto.newStatus;

        const allowed = this.VALID_TRANSITIONS[currentStatus] ?? [];
        if (!allowed.includes(targetStatus)) {
          throw new BadRequestException({
            error: 'INVALID_TRANSITION',
            message: `Invalid state transition: cannot change status from ${currentStatus} to ${targetStatus}`,
            from: currentStatus,
            to: targetStatus,
            allowed,
          });
        }

        const updatePayload: Record<string, unknown> = {
          admissionStatus: targetStatus,
          updatedBy: userId,
        };

        if (targetStatus === 'SUBMITTED') {
          updatePayload.submittedAt = new Date();
        } else if (targetStatus === 'APPROVED') {
          updatePayload.approvedAt = new Date();
          updatePayload.approvedBy = userId;
        } else if (targetStatus === 'REJECTED') {
          updatePayload.rejectedAt = new Date();
          updatePayload.rejectedBy = userId;
        } else if (targetStatus === 'CANCELLED') {
          updatePayload.cancelledAt = new Date();
        }

        const updatedApplicant = await tx.applicant.update({
          where: { id: applicantId },
          data: updatePayload,
        });

        await tx.workflowHistory.create({
          data: {
            organizationId: scope.organizationId,
            branchId: scope.branchId,
            entityType: 'APPLICANT',
            entityId: applicantId,
            oldStatus: currentStatus,
            newStatus: targetStatus,
            actionType: dto.actionType || 'STATUS_CHANGE',
            remarks: dto.remarks || null,
            actionBy: userId || 'SYSTEM',
          },
        });

        await this.outbox.enqueue(
          new AdmissionWorkflowTransitionedEvent({
            applicantId,
            oldStatus: currentStatus,
            newStatus: targetStatus,
            actionType: dto.actionType || 'STATUS_CHANGE',
          }),
          tx,
        );

        return { updated: updatedApplicant, oldStatus: currentStatus };
      },
    );

    void oldStatus;
    return updated;
  }

  async getHistory(applicantId: string, scope: ResourceScope) {
    const applicant = await this.prisma.applicant.findFirst({
      where: { id: applicantId, ...scopedWhere(scope), deletedAt: null },
      select: { id: true },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }

    return this.prisma.workflowHistory.findMany({
      where: {
        entityType: 'APPLICANT',
        entityId: applicantId,
        organizationId: scope.organizationId,
      },
      orderBy: { timestamp: 'desc' },
    });
  }
}
