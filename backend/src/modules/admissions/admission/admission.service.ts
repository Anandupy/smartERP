import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Admission,
  AdmissionExitReason,
  AdmissionType,
  Prisma,
} from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { ResourceScope } from '@/common/scope/resource-scope';

const UNIQUE_VIOLATION = 'P2002';
const CHECK_VIOLATION = 'P2010';

/**
 * One continuous spell of study.
 *
 * **Nothing calls `createControlled` yet.** Admission rows are created by
 * `admit()` (Phase 5), branch transfer and readmission (Phase 6), and the
 * migration importer. The service exists now so those three compose an
 * already-correct operation instead of each inventing its own validation —
 * and so the invariants can be tested before anything depends on them.
 *
 * There is no controller. No route creates, updates or lists admissions:
 * creation belongs to the operations above, and the fields that matter
 * (`branchId`, `studentId`, `admissionNo`, `admissionDate`, `admissionType`)
 * are immutable once written. Reading an admission history is a Student
 * concern and arrives with it.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §16.
 */
@Injectable()
export class AdmissionService {
  private readonly logger = new Logger(AdmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
  ) {}

  /**
   * Open a spell of study.
   *
   * Takes the caller's transaction: `admit()` writes the Student, this
   * Admission and the first Enrollment together, and a spell of study that
   * survived a failed admission would be a ghost nothing points at.
   *
   * `ADMISSION_NO` is branch-scoped and MONOTONIC, so the number commits on its
   * own connection and a rollback here burns it. A gap in an admission register
   * is cosmetic; holding a branch-wide counter for the length of an admission
   * transaction is not.
   */
  async createControlled(
    input: {
      organizationId: string;
      branchId: string;
      studentId: string;
      admissionType: AdmissionType;
      admissionDate: Date;
      entryProgramId: string;
      entryAcademicUnitId: string;
      academicYearId: string;
      quotaId?: string | null;
      admissionSourceId?: string | null;
      sourceApplicantId?: string | null;
      previousAdmissionId?: string | null;
      createdBy?: string | null;
    },
    tx?: PrismaTransactionClient,
  ): Promise<Admission> {
    const client = tx ?? this.prisma;

    await this.assertStudentBelongsToBranch(client, input);
    await this.assertAcademicStructure(client, input);
    await this.assertMastersInScope(client, input);

    const admissionNo = await this.numbering.allocate(
      {
        purpose: 'ADMISSION_NO',
        organizationId: input.organizationId,
        branchId: input.branchId,
        academicYearId: input.academicYearId,
      },
      client,
    );

    try {
      return await client.admission.create({
        data: {
          organizationId: input.organizationId,
          branchId: input.branchId,
          studentId: input.studentId,
          admissionNo,
          admissionType: input.admissionType,
          admissionDate: input.admissionDate,
          entryProgramId: input.entryProgramId,
          entryAcademicUnitId: input.entryAcademicUnitId,
          quotaId: input.quotaId ?? null,
          admissionSourceId: input.admissionSourceId ?? null,
          sourceApplicantId: input.sourceApplicantId ?? null,
          previousAdmissionId: input.previousAdmissionId ?? null,
          createdBy: input.createdBy ?? null,
        },
      });
    } catch (error) {
      throw this.translateConstraint(error, input.studentId);
    }
  }

  /** One admission, within the caller's scope. */
  async findById(id: string, scope: ResourceScope): Promise<Admission> {
    const admission = await this.prisma.admission.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        deletedAt: null,
      },
    });

    if (!admission) {
      throw new NotFoundException('Admission not found');
    }

    return admission;
  }

  /** The spells of study a student has had, newest first. */
  async findByStudent(studentId: string, scope: ResourceScope) {
    return this.prisma.admission.findMany({
      where: {
        studentId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      orderBy: { admissionDate: 'desc' },
    });
  }

  // -------------------------------------------------------------------------

  /**
   * INV-ADM-001 — an admission happens where the student is.
   *
   * Not expressible as a foreign key: `Student.branchId` is a mutable pointer,
   * so a composite key on it would break every admission the moment a student
   * transfers. Checked here, and covered by an integration test because the
   * database cannot carry it.
   */
  private async assertStudentBelongsToBranch(
    client: PrismaTransactionClient,
    input: { studentId: string; organizationId: string; branchId: string },
  ): Promise<void> {
    const student = await client.student.findFirst({
      where: { id: input.studentId, organizationId: input.organizationId },
      select: { id: true, branchId: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (student.branchId !== input.branchId) {
      throw new BadRequestException({
        error: 'ADMISSION_BRANCH_MISMATCH',
        message:
          "The admission branch does not match the student's current branch.",
      });
    }
  }

  /**
   * The entry programme and level must belong to this branch, and the unit to
   * the programme.
   *
   * Checked for *belonging*, not merely existence: accepting any id that
   * resolves is how a student ends up entered against another branch's class.
   */
  private async assertAcademicStructure(
    client: PrismaTransactionClient,
    input: {
      branchId: string;
      entryProgramId: string;
      entryAcademicUnitId: string;
      academicYearId: string;
    },
  ): Promise<void> {
    const program = await client.program.findFirst({
      where: { id: input.entryProgramId, isDeleted: false },
      select: { id: true, branchId: true, isActive: true },
    });

    if (!program) throw new NotFoundException('Program not found');

    if (program.branchId !== input.branchId) {
      throw new BadRequestException({
        error: 'PROGRAM_OUT_OF_SCOPE',
        message: 'The entry programme does not belong to this branch.',
      });
    }

    if (!program.isActive) {
      throw new BadRequestException({
        error: 'PROGRAM_NOT_ACTIVE',
        message: 'The entry programme is not active.',
      });
    }

    const unit = await client.academicUnit.findFirst({
      where: { id: input.entryAcademicUnitId, isDeleted: false },
      select: {
        id: true,
        branchId: true,
        programId: true,
        academicYearId: true,
      },
    });

    if (!unit) throw new NotFoundException('Academic Unit not found');

    if (
      unit.branchId !== input.branchId ||
      unit.programId !== input.entryProgramId
    ) {
      throw new BadRequestException({
        error: 'ACADEMIC_UNIT_MISMATCH',
        message:
          'The entry academic unit does not belong to this branch and programme.',
      });
    }
  }

  /**
   * Quota and admission source must belong to this tenant.
   *
   * A master id from another organization is the same class of hole as an
   * applicant id from another branch — a reference nobody validated.
   */
  private async assertMastersInScope(
    client: PrismaTransactionClient,
    input: {
      organizationId: string;
      branchId: string;
      quotaId?: string | null;
      admissionSourceId?: string | null;
    },
  ): Promise<void> {
    // Masters resolve three-tier: a null organization means platform-seeded and
    // shared, so a row is in scope when it is global or belongs to this tenant.
    const inScope = {
      deletedAt: null,
      isActive: true,
      OR: [{ organizationId: null }, { organizationId: input.organizationId }],
    };

    if (input.quotaId) {
      const quota = await client.quota.findFirst({
        where: { id: input.quotaId, ...inScope },
        select: { id: true },
      });
      if (!quota) {
        throw new BadRequestException({
          error: 'QUOTA_OUT_OF_SCOPE',
          message: 'The quota is not available to this organization.',
        });
      }
    }

    if (input.admissionSourceId) {
      const source = await client.admissionSource.findFirst({
        where: { id: input.admissionSourceId, ...inScope },
        select: { id: true },
      });
      if (!source) {
        throw new BadRequestException({
          error: 'ADMISSION_SOURCE_OUT_OF_SCOPE',
          message:
            'The admission source is not available to this organization.',
        });
      }
    }
  }

  /**
   * Say which rule fired.
   *
   * "This student is already admitted" and "that admission number is taken" are
   * different problems for an operator, and a raw Prisma error is neither.
   */
  private translateConstraint(error: unknown, studentId: string): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const target = String(
        (error.meta as { target?: string | string[] } | undefined)?.target ??
          '',
      );

      if (error.code === UNIQUE_VIOLATION) {
        if (
          target.includes('admission_one_active') ||
          target.includes('studentId')
        ) {
          return new ConflictException({
            error: 'ACTIVE_ADMISSION_EXISTS',
            message:
              'This student already has an active admission. Close it before opening another.',
            studentId,
          });
        }
        if (target.includes('admissionNo')) {
          this.logger.error(
            'Admission number collision; the ADMISSION_NO sequence may be misconfigured.',
          );
          return new ConflictException({
            error: 'ADMISSION_NO_ALREADY_EXISTS',
            message: 'The allocated admission number is already in use.',
          });
        }
      }

      if (error.code === CHECK_VIOLATION) {
        return new BadRequestException({
          error: 'ADMISSION_INVALID',
          message: 'The admission record violates an integrity rule.',
        });
      }
    }

    return error;
  }

  /** The exit reasons, for a future close operation and for tests. */
  static readonly EXIT_REASONS: readonly AdmissionExitReason[] = [
    'GRADUATED',
    'TRANSFER_OUT',
    'BRANCH_TRANSFER',
    'DROPPED_OUT',
    'EXPELLED',
    'DECEASED',
    'CANCELLED_BEFORE_JOINING',
  ];
}
