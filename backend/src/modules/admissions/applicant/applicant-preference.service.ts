import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { ResourceScope, scopedWhere } from '@/common/scope/resource-scope';

const UNIQUE_VIOLATION = 'P2002';

/**
 * Ordered programme choices on one application.
 *
 * Only institutions running an allotment round use these — a school creates
 * zero rows and sets `Applicant.programId` directly. The order is meaningful
 * and is never silently rewritten: an applicant who ranked BSc IT first and was
 * allotted their third choice needs that visible, and a system that quietly
 * renumbered would erase it.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §15.
 */
@Injectable()
export class ApplicantPreferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(applicantId: string, scope: ResourceScope) {
    await this.requireApplicant(applicantId, scope);

    return this.prisma.applicantProgramPreference.findMany({
      where: { applicantId },
      orderBy: { preferenceOrder: 'asc' },
      include: {
        program: {
          select: { id: true, name: true, medium: true, stream: true },
        },
      },
    });
  }

  /**
   * Replace the whole ordered list.
   *
   * Set-the-list rather than add-one, because the positions are only meaningful
   * together: adding a choice at position 2 shifts everything below it, and
   * doing that as a sequence of independent writes would leave two rows sharing
   * a position between statements. Deleting and reinserting inside one
   * transaction means no observer ever sees an inconsistent ranking.
   */
  async replaceAll(
    applicantId: string,
    entries: Array<{ programId: string; remarks?: string | null }>,
    scope: ResourceScope,
  ) {
    const applicant = await this.requireApplicant(applicantId, scope);

    if (this.isFrozen(applicant.admissionStatus)) {
      throw new ConflictException({
        error: 'APPLICANT_FROZEN',
        message: `Preferences cannot be changed for an application in state ${applicant.admissionStatus}.`,
      });
    }

    if (entries.length === 0) {
      throw new BadRequestException({
        error: 'PREFERENCES_EMPTY',
        message: 'At least one programme preference is required.',
      });
    }

    const seen = new Set<string>();
    for (const entry of entries) {
      if (seen.has(entry.programId)) {
        throw new BadRequestException({
          error: 'PREFERENCE_DUPLICATE_PROGRAM',
          message: 'A programme cannot be ranked twice on one application.',
        });
      }
      seen.add(entry.programId);
    }

    await this.assertProgramsInBranch(
      this.prisma,
      entries.map((e) => e.programId),
      applicant.branchId,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.applicantProgramPreference.deleteMany({
          where: { applicantId },
        });

        await tx.applicantProgramPreference.createMany({
          data: entries.map((entry, index) => ({
            applicantId,
            programId: entry.programId,
            // Positions are assigned from the order supplied, so the client
            // sends a list and never a position it has to keep consistent.
            preferenceOrder: index + 1,
            remarks: entry.remarks ?? null,
          })),
        });

        return tx.applicantProgramPreference.findMany({
          where: { applicantId },
          orderBy: { preferenceOrder: 'asc' },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException({
          error: 'PREFERENCE_CONFLICT',
          message: 'The preference list conflicts with an existing entry.',
        });
      }
      throw error;
    }
  }

  private async requireApplicant(applicantId: string, scope: ResourceScope) {
    const applicant = await this.prisma.applicant.findFirst({
      where: {
        id: applicantId,
        ...scopedWhere(scope, { includeAcademicYear: true }),
        deletedAt: null,
      },
      select: { id: true, branchId: true, admissionStatus: true },
    });

    if (!applicant) {
      // Out of scope reads as absent.
      throw new NotFoundException('Applicant not found');
    }

    return applicant;
  }

  /**
   * Every ranked programme must belong to the applicant's own branch.
   *
   * Existence is not enough: accepting any id that resolves lets an application
   * rank another branch's programme, which is the same reference hole as an
   * out-of-scope applicant id.
   */
  private async assertProgramsInBranch(
    client: PrismaTransactionClient,
    programIds: string[],
    branchId: string,
  ): Promise<void> {
    const programs = await client.program.findMany({
      where: { id: { in: programIds }, isDeleted: false },
      select: { id: true, branchId: true, isActive: true },
    });

    const byId = new Map(programs.map((p) => [p.id, p]));

    for (const programId of programIds) {
      const program = byId.get(programId);

      if (!program) {
        throw new NotFoundException({
          error: 'PROGRAM_NOT_FOUND',
          message: 'One of the selected programmes does not exist.',
        });
      }
      if (program.branchId !== branchId) {
        throw new BadRequestException({
          error: 'PROGRAM_OUT_OF_SCOPE',
          message: 'One of the selected programmes belongs to another branch.',
        });
      }
      if (!program.isActive) {
        throw new BadRequestException({
          error: 'PROGRAM_NOT_ACTIVE',
          message: 'One of the selected programmes is not active.',
        });
      }
    }
  }

  /** Once an offer has been made the declaration is evidence, not a draft. */
  private isFrozen(status: string): boolean {
    return [
      'APPROVED',
      'SEAT_CONFIRMED',
      'ADMITTED',
      'DEFERRED',
      'REJECTED',
      'WITHDRAWN',
      'CANCELLED',
    ].includes(status);
  }
}
