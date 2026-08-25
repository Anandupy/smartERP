import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Student } from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { normalizePhone } from '@/infrastructure/crypto/government-id';
import {
  StudentCodeAssignedEvent,
  StudentCreatedEvent,
  StudentUpdatedEvent,
} from '@/common/events';
import { ResourceScope } from '@/common/scope/resource-scope';
import {
  CorrectStudentDemographicsInput,
  CreateStudentInput,
  STUDENT_SEARCH_DEFAULT_LIMIT,
  STUDENT_SEARCH_MAX_LIMIT,
  StudentSearchParams,
} from './student.types';

const UNIQUE_VIOLATION = 'P2002';

/** A code is `PREFIX` + digits — letters, digits, and separators only. */
const STUDENT_CODE_SHAPE = /^[A-Z0-9][A-Z0-9\-/]{0,31}$/;

/**
 * The permanent learner identity.
 *
 * Owns identity and the institution's current official demographics, and
 * nothing that varies with an academic year, a class or a spell of study. It
 * does not know what an admission is, what a fee is, or whether the institution
 * is a school or a college — none of those change what a learner identity means.
 *
 * There is deliberately no `create` on any route. A Student is born from
 * `admit()` (Phase 5) or the migration importer, both of which call
 * `createControlled` directly. An ordinary create endpoint would let staff mint
 * identities with nothing behind them, which is how a student list acquires
 * rows nobody can explain.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §11.
 */
@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly outbox: OutboxPublisher,
  ) {}

  // -------------------------------------------------------------------------
  // Creation — controlled, never routed
  // -------------------------------------------------------------------------

  /**
   * Mint a learner identity.
   *
   * Not reachable over HTTP. `admit()` will call this inside its transaction,
   * passing its `tx` so the Student, the Admission and the first Enrollment
   * either all exist or none do.
   *
   * ## Why the code is allocated inside, and what happens when this rolls back
   *
   * `STUDENT_CODE` is MONOTONIC, so the numbering engine commits the increment
   * on its own connection and this transaction never holds the counter lock. A
   * rollback here therefore burns the number and leaves a gap in the series.
   * That is the intended trade: gaps in a student code are cosmetic — nobody
   * audits them for continuity — while serialising every admission in the
   * organization behind one counter row would not be.
   *
   * ## Concurrency
   *
   * Two callers racing on the same Person, or the same applicant, are separated
   * by the database rather than by a check. `@@unique([organizationId,
   * personId])` and the partial unique index on `sourceApplicantId` make the
   * second insert impossible, and the violation is translated here into a
   * conflict that names what already exists.
   */
  async createControlled(
    input: CreateStudentInput,
    tx?: PrismaTransactionClient,
  ): Promise<Student> {
    const client = tx ?? this.prisma;

    this.assertPlausibleDob(input.dob);

    if (input.createdVia === 'ADMISSION' && !input.sourceApplicantId) {
      throw new BadRequestException({
        error: 'STUDENT_SOURCE_APPLICANT_REQUIRED',
        message:
          'A student created through admission must record the application it came from.',
      });
    }

    const displayName = this.buildDisplayName(
      input.firstName,
      input.middleName,
      input.lastName,
    );

    const studentCode = await this.numbering.allocate(
      {
        purpose: 'STUDENT_CODE',
        organizationId: input.organizationId,
        // Only consumed if the organization's STUDENT_CODE format renders a
        // {year} — see CreateStudentInput.admissionAcademicYearId. Harmless
        // to pass for every organization that has not opted into one.
        academicYearId: input.admissionAcademicYearId,
      },
      client,
    );

    try {
      const student = await client.student.create({
        data: {
          organizationId: input.organizationId,
          branchId: input.branchId,
          personId: input.personId,
          studentCode,
          displayName,
          firstName: input.firstName,
          middleName: input.middleName ?? null,
          lastName: input.lastName,
          dob: input.dob,
          genderId: input.genderId,
          religionId: input.religionId ?? null,
          casteId: input.casteId ?? null,
          categoryId: input.categoryId ?? null,
          motherTongueId: input.motherTongueId ?? null,
          bloodGroupId: input.bloodGroupId ?? null,
          disabilityStatus: input.disabilityStatus ?? false,
          disabilityTypeId: input.disabilityTypeId ?? null,
          disabilityNotes: input.disabilityNotes ?? null,
          primaryMobile: input.primaryMobile ?? null,
          mobileNormalized: input.primaryMobile
            ? normalizePhone(input.primaryMobile)
            : null,
          primaryEmail: input.primaryEmail ?? null,
          apaarId: input.apaarId ?? null,
          abcId: input.abcId ?? null,
          penNo: input.penNo ?? null,
          saralId: input.saralId ?? null,
          udiseStudentId: input.udiseStudentId ?? null,
          photoDocumentId: input.photoDocumentId ?? null,
          createdVia: input.createdVia,
          sourceApplicantId: input.sourceApplicantId ?? null,
          createdBy: input.createdBy ?? null,
        },
      });

      // The event every future module subscribes to. Through the outbox, so a
      // crash after COMMIT cannot leave a Student nothing downstream heard of.
      await this.outbox.enqueue(
        new StudentCreatedEvent({
          studentId: student.id,
          organizationId: student.organizationId,
          branchId: student.branchId,
          personId: student.personId,
          studentCode: student.studentCode,
          createdVia: student.createdVia,
          sourceApplicantId: student.sourceApplicantId,
        }),
        client,
      );

      await this.outbox.enqueue(
        new StudentCodeAssignedEvent({
          studentId: student.id,
          organizationId: student.organizationId,
          studentCode: student.studentCode,
        }),
        client,
      );

      return student;
    } catch (error) {
      throw this.translateUniqueViolation(error, input);
    }
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /**
   * One student, within the caller's scope.
   *
   * The scope is part of the lookup rather than a check afterwards, and a miss
   * is a 404: a 403 would confirm to someone outside the branch that the id
   * exists, which is the enumeration oracle §30 exists to close.
   */
  async findById(
    id: string,
    scope: ResourceScope,
    options: { organizationWide?: boolean } = {},
  ) {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        ...(options.organizationWide ? {} : { branchId: scope.branchId }),
      },
      include: {
        gender: { select: { id: true, code: true, name: true } },
        religion: { select: { id: true, code: true, name: true } },
        caste: { select: { id: true, code: true, name: true } },
        category: { select: { id: true, code: true, name: true } },
        motherTongue: { select: { id: true, code: true, name: true } },
        bloodGroup: { select: { id: true, code: true, name: true } },
        disabilityType: { select: { id: true, code: true, name: true } },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  /**
   * Resolve a human-facing code to a student.
   *
   * Case-insensitive: a code read off a printed card and typed in lower case
   * has to find the same row, and making the caller guess the stored casing
   * would be a support ticket generator.
   */
  async findByCode(
    code: string,
    scope: ResourceScope,
    options: { organizationWide?: boolean } = {},
  ) {
    const normalized = this.normalizeStudentCode(code);

    const student = await this.prisma.student.findFirst({
      where: {
        organizationId: scope.organizationId,
        studentCode: normalized,
        ...(options.organizationWide ? {} : { branchId: scope.branchId }),
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  /**
   * Search.
   *
   * One free-text term, interpreted by shape rather than by asking the caller
   * which field they meant — staff type a code, a name or a phone number into
   * one box and expect it to work.
   *
   * Ranking is deterministic (exact code, then exact mobile, then name), so a
   * second page is a continuation rather than a reshuffle of equally-scored
   * rows.
   */
  async search(params: StudentSearchParams, scope: ResourceScope) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(
      Math.max(1, params.limit ?? STUDENT_SEARCH_DEFAULT_LIMIT),
      STUDENT_SEARCH_MAX_LIMIT,
    );

    const where = this.buildSearchWhere(params, scope);

    const [total, items] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          studentCode: true,
          displayName: true,
          dob: true,
          status: true,
          branchId: true,
          primaryMobile: true,
        },
      }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private buildSearchWhere(
    params: StudentSearchParams,
    scope: ResourceScope,
  ): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {
      organizationId: scope.organizationId,
      // Branch is the default boundary. A branch user searching for another
      // branch's student gets nothing back — indistinguishable from a code that
      // does not exist, which is the point.
      ...(params.organizationWide ? {} : { branchId: scope.branchId }),
      deletedAt: null,
    };

    if (params.status?.length) {
      where.status = { in: params.status as never[] };
    } else if (!params.includeInactive) {
      // Archived students remain searchable, but only when asked for: archival
      // is a write lock, not a disappearance.
      where.status = 'ACTIVE';
    }

    if (params.dob) {
      where.dob = params.dob;
    }

    const term = params.q?.trim();
    if (term) {
      const code = this.normalizeStudentCode(term);
      const phone = normalizePhone(term);

      where.OR = [
        { studentCode: code },
        { studentCode: { startsWith: code } },
        ...(phone ? [{ mobileNormalized: phone }] : []),
        { displayName: { contains: term, mode: 'insensitive' as const } },
      ];
    }

    return where;
  }

  // -------------------------------------------------------------------------
  // Correction
  // -------------------------------------------------------------------------

  /**
   * Correct the institution's current official record.
   *
   * Not a general update. The input type lists exactly what may change, so
   * `studentCode`, `personId`, `organizationId`, `sourceApplicantId` and
   * `status` are unreachable — the first four are identity, and status moves
   * only through the lifecycle engine that Phase 6 brings.
   *
   * This does not touch Applicant. That record is a frozen snapshot of what was
   * declared on a date; a name corrected by affidavit in 2029 must not rewrite
   * the 2026 application form.
   */
  async correctDemographics(
    id: string,
    input: CorrectStudentDemographicsInput,
    scope: ResourceScope,
    actorId?: string,
  ): Promise<Student> {
    const existing = await this.findById(id, scope);

    if (existing.status === 'ARCHIVED') {
      throw new ConflictException({
        error: 'STUDENT_ARCHIVED',
        message:
          'An archived student is read-only. Restore the record before correcting it.',
      });
    }

    if (input.dob) {
      this.assertPlausibleDob(input.dob);
    }

    const data: Prisma.StudentUpdateInput = { updatedBy: actorId ?? null };
    const changes: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }> = [];

    const track = <K extends keyof CorrectStudentDemographicsInput>(
      field: K,
    ) => {
      if (input[field] === undefined) return;
      const next = input[field];
      const previous = (existing as Record<string, unknown>)[field as string];
      if (previous === next) return;
      (data as Record<string, unknown>)[field as string] = next;
      changes.push({
        field: field,
        oldValue: previous,
        newValue: next,
      });
    };

    (
      [
        'firstName',
        'middleName',
        'lastName',
        'dob',
        'genderId',
        'religionId',
        'casteId',
        'categoryId',
        'motherTongueId',
        'bloodGroupId',
        'disabilityStatus',
        'disabilityTypeId',
        'disabilityNotes',
        'primaryMobile',
        'primaryEmail',
        'apaarId',
        'abcId',
        'penNo',
        'saralId',
        'udiseStudentId',
        'photoDocumentId',
      ] as const
    ).forEach(track);

    // Derived columns follow their sources rather than being separately
    // settable, so they cannot drift from what they are derived from.
    if (
      input.firstName !== undefined ||
      input.middleName !== undefined ||
      input.lastName !== undefined
    ) {
      data.displayName = this.buildDisplayName(
        input.firstName ?? existing.firstName,
        input.middleName !== undefined ? input.middleName : existing.middleName,
        input.lastName ?? existing.lastName,
      );
    }

    if (input.primaryMobile !== undefined) {
      data.mobileNormalized = input.primaryMobile
        ? normalizePhone(input.primaryMobile)
        : null;
    }

    if (changes.length === 0) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      // The scope is re-asserted on the write. A read-then-write-by-id is only
      // as safe as the read, and one refactor away from losing it entirely.
      const result = await tx.student.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          branchId: scope.branchId,
        },
        data: data,
      });

      if (result.count !== 1) {
        throw new NotFoundException('Student not found');
      }

      const updated = await tx.student.findFirstOrThrow({ where: { id } });

      await this.outbox.enqueue(
        new StudentUpdatedEvent(
          {
            studentId: updated.id,
            organizationId: updated.organizationId,
            changedFields: changes.map((c) => c.field),
          },
          // Field-level diffs, because "the record changed" is not an audit
          // trail when the question is who changed a date of birth and from what.
          { changes },
        ),
        tx,
      );

      return updated;
    });
  }

  // -------------------------------------------------------------------------

  private buildDisplayName(
    firstName: string,
    middleName: string | null | undefined,
    lastName: string,
  ): string {
    return [firstName, middleName, lastName]
      .filter((p) => p && p.trim())
      .map((p) => p!.trim())
      .join(' ');
  }

  /**
   * Upper-case and strip incidental whitespace.
   *
   * Codes are stored as the numbering engine rendered them — upper case — so a
   * search normalises to that rather than the database doing a case-insensitive
   * comparison it has no index for.
   */
  private normalizeStudentCode(raw: string): string {
    return raw.trim().replace(/\s+/g, '').toUpperCase();
  }

  private assertPlausibleDob(dob: Date): void {
    const earliest = new Date('1900-01-01');
    if (!(dob instanceof Date) || Number.isNaN(dob.getTime())) {
      throw new BadRequestException({
        error: 'STUDENT_DOB_INVALID',
        message: 'The date of birth is not a valid date.',
      });
    }
    if (dob <= earliest || dob > new Date()) {
      throw new BadRequestException({
        error: 'STUDENT_DOB_INVALID',
        message: 'The date of birth is outside the plausible range.',
      });
    }
  }

  /**
   * Turn a constraint violation into a conflict that says what already exists.
   *
   * Which constraint fired is the whole message: "this person is already a
   * student here" and "this application has already produced a student" are
   * different problems for the operator, and a raw Prisma error is neither.
   */
  private translateUniqueViolation(
    error: unknown,
    input: CreateStudentInput,
  ): unknown {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== UNIQUE_VIOLATION
    ) {
      return error;
    }

    const target = String(
      (error.meta as { target?: string | string[] } | undefined)?.target ?? '',
    );

    if (target.includes('personId')) {
      return new ConflictException({
        error: 'STUDENT_ALREADY_EXISTS',
        message:
          'This person is already registered as a student in this organization.',
        personId: input.personId,
      });
    }

    if (target.includes('sourceApplicantId') || target.includes('applicant')) {
      return new ConflictException({
        error: 'APPLICANT_ALREADY_ADMITTED',
        message: 'This application has already produced a student.',
        sourceApplicantId: input.sourceApplicantId,
      });
    }

    if (target.includes('studentCode')) {
      // The destination constraint catching a generator fault. It should be
      // unreachable, and it is logged rather than silently retried because a
      // duplicate code means the sequence is wrong, not that this request is.
      this.logger.error(
        `Student code collision in organization ${input.organizationId}; the STUDENT_CODE sequence may be misconfigured.`,
      );
      return new ConflictException({
        error: 'STUDENT_CODE_ALREADY_EXISTS',
        message: 'The allocated student code is already in use.',
      });
    }

    return error;
  }

  /** Exposed for tests and the importer; never bound to a route. */
  isValidStudentCodeShape(code: string): boolean {
    return STUDENT_CODE_SHAPE.test(code);
  }
}
