import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { AdmissionWorkflowTransitionedEvent } from '@/common/events';
import { TransitionDto, WorkflowState } from './dto/workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  private readonly VALID_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
    [WorkflowState.DRAFT]: [WorkflowState.SUBMITTED, WorkflowState.CANCELLED],
    [WorkflowState.SUBMITTED]: [
      WorkflowState.UNDER_REVIEW,
      WorkflowState.CANCELLED,
      WorkflowState.REJECTED,
    ],
    [WorkflowState.UNDER_REVIEW]: [
      WorkflowState.DOCUMENT_PENDING,
      WorkflowState.FEE_PENDING,
      WorkflowState.WAITLISTED,
      WorkflowState.APPROVED,
      WorkflowState.REJECTED,
      WorkflowState.CANCELLED,
    ],
    [WorkflowState.DOCUMENT_PENDING]: [
      WorkflowState.UNDER_REVIEW,
      WorkflowState.APPROVED,
      WorkflowState.REJECTED,
      WorkflowState.CANCELLED,
    ],
    [WorkflowState.FEE_PENDING]: [
      WorkflowState.APPROVED,
      WorkflowState.REJECTED,
      WorkflowState.CANCELLED,
    ],
    [WorkflowState.WAITLISTED]: [
      WorkflowState.APPROVED,
      WorkflowState.REJECTED,
      WorkflowState.CANCELLED,
    ],
    [WorkflowState.APPROVED]: [],
    [WorkflowState.REJECTED]: [],
    [WorkflowState.CANCELLED]: [],
  };

  async transitionState(
    applicantId: string,
    dto: TransitionDto,
    userId?: string,
  ) {
    let oldStatus: string = '';
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch current applicant
      const applicant = await tx.applicant.findUnique({
        where: { id: applicantId },
      });

      if (!applicant) {
        throw new NotFoundException('Applicant not found');
      }

      const currentStatus = applicant.admissionStatus as WorkflowState;
      oldStatus = currentStatus;
      const targetStatus = dto.newStatus;

      // 2. Validate transition
      const allowed = this.VALID_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(targetStatus)) {
        throw new BadRequestException(
          `Invalid state transition: Cannot change status from ${currentStatus} to ${targetStatus}`,
        );
      }

      // 3. Prepare update payload
      const updatePayload: any = {
        admissionStatus: targetStatus,
        updatedBy: userId,
      };

      if (targetStatus === WorkflowState.SUBMITTED) {
        updatePayload.submittedAt = new Date();
      } else if (targetStatus === WorkflowState.APPROVED) {
        updatePayload.approvedAt = new Date();
        updatePayload.approvedBy = userId;
      } else if (targetStatus === WorkflowState.REJECTED) {
        updatePayload.rejectedAt = new Date();
        updatePayload.rejectedBy = userId;
      } else if (targetStatus === WorkflowState.CANCELLED) {
        updatePayload.cancelledAt = new Date();
      }

      // 4. Update applicant
      const updatedApplicant = await tx.applicant.update({
        where: { id: applicantId },
        data: updatePayload,
      });

      // 5. Log history
      await tx.workflowHistory.create({
        data: {
          applicantId,
          oldStatus: currentStatus,
          newStatus: targetStatus,
          actionType: dto.actionType || 'STATUS_CHANGE',
          remarks: dto.remarks || '',
          actionBy: userId || 'SYSTEM',
        },
      });

      // 6. Future student conversion hook
      if (targetStatus === WorkflowState.APPROVED) {
        await this.triggerStudentConversionHook(applicantId, tx);
      }

      return updatedApplicant;
    });

    await this.eventBus.publish(
      new AdmissionWorkflowTransitionedEvent({
        applicantId,
        oldStatus,
        newStatus: dto.newStatus,
        actionType: dto.actionType || 'STATUS_CHANGE',
      }),
    );

    return result;
  }

  async getHistory(applicantId: string) {
    const applicant = await this.prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }

    return this.prisma.workflowHistory.findMany({
      where: { applicantId },
      orderBy: { timestamp: 'desc' },
    });
  }

  private async triggerStudentConversionHook(applicantId: string, _tx: any) {
    // Placeholder hook log - this will be extended in future phases to generate permanent student records
    // eslint-disable-next-line no-console
    console.log(
      `[STUDENT_CONVERSION_HOOK] Applicant ${applicantId} has been APPROVED. Triggering student registration workflows.`,
    );
    return Promise.resolve();
  }
}
