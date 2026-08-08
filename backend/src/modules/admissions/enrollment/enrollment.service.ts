import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { EnrollmentCompletedEvent } from '@/common/events';
import { ResourceScope, scopedWhere } from '@/common/scope/resource-scope';
import { CreateEnrollmentDto } from './dto/enrollment.dto';

/**
 * Academic placement.
 *
 * PHASE 0 SCOPE. This service keeps its current responsibility — turning an
 * approved applicant into a placement — while the holes underneath it are
 * closed. It moves to `src/modules/enrollment/` and gains `studentId`,
 * `admissionId`, provenance and the supersede mechanism in Phase 4, and stops
 * being an entry point at all in Phase 5, when `admit()` becomes the only way a
 * first enrollment is created.
 *
 * What Phase 0 fixes here is the most serious defect found in the audit: the
 * applicant was fetched by id with no scope check, and the enrollment was then
 * written with the *caller's* organization, branch and academic year. A Branch A
 * administrator could therefore enroll a Branch B applicant into Branch A. That
 * is not a read leak — it is a cross-branch write that fabricates a placement.
 */
@Injectable()
export class EnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxPublisher,
  ) {}

  async createEnrollment(
    applicantId: string,
    dto: CreateEnrollmentDto,
    scope: ResourceScope,
  ) {
    // The applicant is resolved *within the caller's scope*. Its own
    // organization, branch and year are then what the enrollment is written
    // with — never the request context, which is used to authorise the
    // operation, not to populate the row.
    const applicant = await this.prisma.applicant.findFirst({
      where: {
        id: applicantId,
        ...scopedWhere(scope, { includeAcademicYear: true }),
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        branchId: true,
        academicYearId: true,
        admissionStatus: true,
      },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }

    if (applicant.admissionStatus !== 'APPROVED') {
      throw new BadRequestException({
        error: 'APPLICANT_NOT_ELIGIBLE',
        message: `Cannot enroll applicant. Current status is ${applicant.admissionStatus}. Applicant must be APPROVED first.`,
        currentStatus: applicant.admissionStatus,
      });
    }

    await this.assertAcademicYearOpen(applicant.academicYearId);
    await this.assertAcademicStructureBelongsToApplicant(dto, applicant);

    const existing = await this.prisma.enrollment.findFirst({
      where: {
        applicantId,
        academicYearId: applicant.academicYearId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException({
        error: 'ENROLLMENT_EXISTS_FOR_YEAR',
        message: 'Applicant is already enrolled for this academic year',
        enrollmentId: existing.id,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: {
          organizationId: applicant.organizationId,
          branchId: applicant.branchId,
          academicYearId: applicant.academicYearId,
          programId: dto.programId,
          academicUnitId: dto.academicUnitId,
          applicantId,
          rollNumber: dto.rollNumber || null,
          enrollmentStatus: dto.enrollmentStatus || 'ACTIVE',
        },
        include: { program: true, academicUnit: true },
      });

      await this.outbox.enqueue(
        new EnrollmentCompletedEvent(
          {
            applicantId,
            programId: enrollment.programId,
            academicUnitId: enrollment.academicUnitId,
            rollNumber: enrollment.rollNumber || undefined,
          },
          { action: 'CREATE' },
        ),
        tx,
      );

      return enrollment;
    });
  }

  async getEnrollment(applicantId: string, scope: ResourceScope) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        applicantId,
        ...scopedWhere(scope, { includeAcademicYear: true }),
        deletedAt: null,
      },
      include: { program: true, academicUnit: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!enrollment) {
      throw new NotFoundException(
        'Enrollment record not found for this applicant',
      );
    }
    return enrollment;
  }

  /**
   * A locked academic year rejects every write.
   *
   * Nothing in admissions checked this before, so a year could be closed for
   * results and still accept new placements. Disabling the control in the UI is
   * not enforcement.
   */
  private async assertAcademicYearOpen(academicYearId: string): Promise<void> {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, isDeleted: false },
      select: { id: true, isLocked: true },
    });

    if (!year) {
      throw new NotFoundException('Academic year not found');
    }

    if (year.isLocked) {
      throw new ForbiddenException({
        error: 'ACADEMIC_YEAR_LOCKED',
        message: 'The academic year is locked and cannot accept enrolments.',
        academicYearId,
      });
    }
  }

  /**
   * The program and academic unit must belong to the applicant's own branch and
   * year, and the unit must belong to the program.
   *
   * Previously both were checked only for *existence*, so any id in the
   * database was accepted — including a class in another branch entirely.
   */
  private async assertAcademicStructureBelongsToApplicant(
    dto: CreateEnrollmentDto,
    applicant: { branchId: string; academicYearId: string },
  ): Promise<void> {
    const program = await this.prisma.program.findFirst({
      where: { id: dto.programId, isDeleted: false },
      select: { id: true, branchId: true },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    const academicUnit = await this.prisma.academicUnit.findFirst({
      where: { id: dto.academicUnitId, isDeleted: false },
      select: {
        id: true,
        branchId: true,
        programId: true,
        academicYearId: true,
      },
    });

    if (!academicUnit) {
      throw new NotFoundException('Academic Unit not found');
    }

    if (program.branchId !== applicant.branchId) {
      throw new BadRequestException({
        error: 'ACADEMIC_UNIT_MISMATCH',
        message: "The program does not belong to the applicant's branch.",
      });
    }

    if (academicUnit.branchId !== applicant.branchId) {
      throw new BadRequestException({
        error: 'ACADEMIC_UNIT_MISMATCH',
        message: "The academic unit does not belong to the applicant's branch.",
      });
    }

    if (academicUnit.academicYearId !== applicant.academicYearId) {
      throw new BadRequestException({
        error: 'ACADEMIC_UNIT_MISMATCH',
        message:
          "The academic unit does not belong to the applicant's academic year.",
      });
    }

    if (academicUnit.programId !== dto.programId) {
      throw new BadRequestException({
        error: 'ACADEMIC_UNIT_MISMATCH',
        message: 'The academic unit does not belong to the given program.',
      });
    }
  }
}
