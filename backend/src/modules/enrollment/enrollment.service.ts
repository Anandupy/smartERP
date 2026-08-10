import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  Enrollment,
  EnrollmentKind,
  EnrollmentOriginType,
  EnrollmentStatus,
  Prisma,
  RoleType,
} from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { RowLockService } from '@/infrastructure/database/row-lock.service';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import {
  EnrollmentCreatedEvent,
  EnrollmentRollNumberChangedEvent,
  EnrollmentStatusChangedEvent,
  EnrollmentSupersededEvent,
} from '@/common/events';
import { ResourceScope } from '@/common/scope/resource-scope';
import { EnrollmentConfigProvider } from './enrollment-config.provider';
import { isLegalTransition, isOpen } from './enrollment.transitions';
import {
  AssignRollNumberInput,
  CancelEnrollmentInput,
  CreateInitialEnrollmentInput,
  EnrollmentActor,
  EnrollmentSearchParams,
  ENROLLMENT_SEARCH_DEFAULT_LIMIT,
  ENROLLMENT_SEARCH_MAX_LIMIT,
  SupersedeEnrollmentInput,
} from './enrollment.types';

const UNIQUE_VIOLATION = 'P2002';
const FK_VIOLATION = 'P2003';

/** Columns every placement operation needs to read under its lock. */
const LOCKED_COLUMNS = [
  'organizationId',
  'branchId',
  'academicYearId',
  'admissionId',
  'studentId',
  'programId',
  'academicUnitId',
  'rollNumber',
  'enrollmentKind',
  'enrollmentStatus',
  'originType',
  'supersededById',
  'applicantId',
  'resultOutcome',
  'version',
  'deletedAt',
] as const;

type LockedEnrollment = Record<(typeof LOCKED_COLUMNS)[number], unknown> & {
  id: string;
};

/**
 * Academic placement — where a learner sits for one academic year.
 *
 * The spine attendance, examination, fees and the timetable will hang off, and
 * the reason none of them has to know what an admission is.
 *
 * ## What this service refuses to be
 *
 * There is no `update()`. Placement is **immutable**: an enrolment's branch,
 * year, admission, student, programme and academic unit are fixed the moment it
 * is written. Getting one wrong is put right by writing a *replacement* and
 * closing the original, so both versions stay visible and a report can tell an
 * operator's mistake from a genuine mid-year move. A generic PATCH would erase
 * exactly that distinction, one field at a time.
 *
 * There is no `create()` on any route either. Enrolments are born from
 * `admit()`, promotion, repeat, correction, transfer, readmission and the
 * migration importer — each of which knows a *reason*. A bare `POST
 * /enrollments` is a placement with no origin, which is how a class list
 * acquires students nobody can account for.
 *
 * ## What it never imports
 *
 * Admissions. The schema holds an `admissionId`; the module holds no import,
 * because admissions is a three-month intake funnel and this is a twelve-year
 * concern. Nor Examination, which writes `resultOutcome` under its own
 * authorisation — Enrollment owns the column and not the decision.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §18.
 */
@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLock: RowLockService,
    private readonly outbox: OutboxPublisher,
    private readonly authorization: AuthorizationService,
    private readonly config: EnrollmentConfigProvider,
  ) {}

  // ---------------------------------------------------------------------------
  // Creation — controlled, never routed
  // ---------------------------------------------------------------------------

  /**
   * The first placement of a spell of study.
   *
   * **Not reachable over HTTP.** Phase 5's `admit()` will call this inside its
   * own transaction, passing its `tx`, so the Student, the Admission and this
   * row either all exist or none do. It therefore opens no transaction of its
   * own when one is supplied, publishes nothing directly to the event bus, and
   * reads no request context — a method that quietly ignored a passed `tx` and
   * used the global client is the single most common way an "atomic" operation
   * turns out not to be.
   *
   * Every scope value comes from the caller, which took it from the Admission's
   * lineage. Nothing here reads the request context, so there is no path by
   * which a caller's branch could be stamped onto another branch's placement.
   */
  async createInitialEnrollment(
    input: CreateInitialEnrollmentInput,
    tx?: PrismaTransactionClient,
  ): Promise<Enrollment> {
    const originType = input.originType ?? EnrollmentOriginType.ADMISSION;

    if (
      originType === EnrollmentOriginType.CORRECTION ||
      originType === EnrollmentOriginType.TRANSFER
    ) {
      // Those two replace something. They arrive through `supersedeEnrollment`,
      // which is the only place that can set the link and close the old row.
      throw new BadRequestException({
        error: 'ORIGIN_REQUIRES_SUPERSEDE',
        message:
          'A correction or a transfer replaces an existing placement and must go through the supersede operation.',
      });
    }

    // With a caller's transaction, join it. Without one, open our own — the
    // row and its outbox event have to commit together either way. Running
    // bare on the global client would let a placement exist while the event
    // that tells fees, attendance and the timetable about it was lost.
    const run = (client: PrismaTransactionClient) =>
      this.writeInitialEnrollment(client, input, originType);

    try {
      return tx ? await run(tx) : await this.prisma.$transaction(run);
    } catch (error) {
      throw this.translateConstraint(error);
    }
  }

  private async writeInitialEnrollment(
    client: PrismaTransactionClient,
    input: CreateInitialEnrollmentInput,
    originType: EnrollmentOriginType,
  ): Promise<Enrollment> {
    await this.assertAcademicYearOpen(
      client,
      input.academicYearId,
      input.branchId,
    );

    if (input.rollNumber !== undefined && input.rollNumber !== null) {
      this.assertRollNumberShape(input.rollNumber);
    }

    const enrollment = await client.enrollment.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId,
        academicYearId: input.academicYearId,
        admissionId: input.admissionId,
        studentId: input.studentId,
        programId: input.programId,
        academicUnitId: input.academicUnitId,
        rollNumber: input.rollNumber?.trim() || null,
        enrollmentKind: input.enrollmentKind ?? EnrollmentKind.PRIMARY,
        enrollmentStatus: input.enrollmentStatus ?? EnrollmentStatus.ACTIVE,
        isRepeat: input.isRepeat ?? false,
        originType,
        applicantId: input.applicantId ?? null,
        createdBy: input.createdBy ?? null,
      },
    });

    await this.outbox.enqueue(
      new EnrollmentCreatedEvent({
        enrollmentId: enrollment.id,
        organizationId: enrollment.organizationId,
        branchId: enrollment.branchId,
        academicYearId: enrollment.academicYearId,
        studentId: enrollment.studentId,
        admissionId: enrollment.admissionId,
        programId: enrollment.programId,
        academicUnitId: enrollment.academicUnitId,
        enrollmentKind: enrollment.enrollmentKind,
        originType: enrollment.originType,
        previousEnrollmentId: null,
      }),
      client,
    );

    return enrollment;
  }

  // ---------------------------------------------------------------------------
  // The supersede primitive
  // ---------------------------------------------------------------------------

  /**
   * Replace a placement, keeping both rows.
   *
   * **One primitive, four callers.** Correction and mid-year transfer use it
   * today; promotion and repeat will use it in Phase 6. Writing the fourth one
   * separately is how provenance gets forgotten by whoever writes it, so there
   * is only ever one place that knows how to link an old row to a new one.
   *
   * The order is not negotiable. The old row is locked **first**, before any
   * decision and before the replacement is built: creating the replacement and
   * then discovering the original was already superseded leaves an orphan row
   * that satisfies every constraint and means nothing. With the lock first, the
   * loser of a race re-reads under `READ COMMITTED`, sees `SUPERSEDED`, and
   * fails having written nothing.
   */
  async supersedeEnrollment(
    input: SupersedeEnrollmentInput,
    scope: ResourceScope,
    actor: EnrollmentActor,
    tx?: PrismaTransactionClient,
  ): Promise<{ previous: Enrollment; current: Enrollment }> {
    const reason = this.requireReason(input.reason);

    await this.assertPermitted(actor, PERMISSIONS.Enrollment.Correct);

    const run = async (client: PrismaTransactionClient) => {
      const locked = await this.lockEnrollment(
        client,
        input.enrollmentId,
        scope,
      );

      await this.assertAcademicYearOpen(
        client,
        locked.academicYearId as string,
        locked.branchId as string,
      );

      this.assertVersion(locked, input.expectedVersion);

      const currentStatus = locked.enrollmentStatus as EnrollmentStatus;

      if (!isOpen(currentStatus)) {
        throw new ConflictException({
          error: 'ENROLLMENT_CLOSED',
          message: `A placement in state ${currentStatus} is history and is not replaced. Its successor already exists, or it was closed deliberately.`,
          enrollmentStatus: currentStatus,
        });
      }

      if (!isLegalTransition(currentStatus, input.closingStatus)) {
        throw new BadRequestException({
          error: 'INVALID_TRANSITION',
          message: `A placement cannot move from ${currentStatus} to ${input.closingStatus}.`,
          from: currentStatus,
          to: input.closingStatus,
        });
      }

      // Anything the caller did not name is carried over, so a section change
      // cannot silently move the programme as well.
      const programId = input.programId ?? (locked.programId as string);
      const academicUnitId =
        input.academicUnitId ?? (locked.academicUnitId as string);

      if (
        programId === locked.programId &&
        academicUnitId === locked.academicUnitId &&
        input.rollNumber === undefined
      ) {
        throw new BadRequestException({
          error: 'PLACEMENT_UNCHANGED',
          message:
            'The replacement placement is identical to the current one. Nothing would be corrected.',
        });
      }

      if (input.rollNumber !== undefined && input.rollNumber !== null) {
        this.assertRollNumberShape(input.rollNumber);
      }

      // The replacement's id is generated here rather than by the database,
      // because the old row has to be closed *before* the new one is inserted
      // and closing it requires naming its successor.
      //
      // Insert-then-close cannot work: `enrollment_one_primary_per_year` counts
      // the original while it is still live, so the replacement is rejected by
      // the very index that makes the correction necessary. Closing first with
      // a known id satisfies both that index and `enrollment_supersede_check`,
      // which demands a successor the moment the status becomes SUPERSEDED.
      const replacementId = uuidv7();

      const previous = await client.enrollment.update({
        where: { id: input.enrollmentId },
        data: {
          enrollmentStatus: input.closingStatus,
          supersededById: replacementId,
          changeReason: reason,
          updatedBy: actor.userId ?? null,
          version: { increment: 1 },
        },
      });

      const replacement = await client.enrollment.create({
        data: {
          id: replacementId,
          // Scope, admission and student are copied from the row being
          // replaced, never from the request context. A correction can change
          // where a student sits; it can never move them to another branch,
          // another year or another spell of study.
          organizationId: locked.organizationId as string,
          branchId: locked.branchId as string,
          academicYearId: locked.academicYearId as string,
          admissionId: locked.admissionId as string,
          studentId: locked.studentId as string,
          applicantId: (locked.applicantId as string | null) ?? null,
          enrollmentKind: locked.enrollmentKind as EnrollmentKind,

          programId,
          academicUnitId,
          rollNumber:
            input.rollNumber === undefined
              ? ((locked.rollNumber as string | null) ?? null)
              : (input.rollNumber?.trim() ?? null),

          enrollmentStatus: EnrollmentStatus.ACTIVE,
          originType: input.originType,
          previousEnrollmentId: input.enrollmentId,
          changeReason: reason,
          isRepeat: false,
          createdBy: actor.userId ?? null,
        },
      });

      await this.writeHistory(client, {
        enrollmentId: input.enrollmentId,
        organizationId: previous.organizationId,
        branchId: previous.branchId,
        from: currentStatus,
        to: input.closingStatus,
        actionType: input.originType,
        remarks: reason,
        actor,
      });

      await this.writeHistory(client, {
        enrollmentId: replacement.id,
        organizationId: replacement.organizationId,
        branchId: replacement.branchId,
        from: null,
        to: EnrollmentStatus.ACTIVE,
        actionType: input.originType,
        remarks: reason,
        actor,
      });

      await this.outbox.enqueue(
        new EnrollmentCreatedEvent({
          enrollmentId: replacement.id,
          organizationId: replacement.organizationId,
          branchId: replacement.branchId,
          academicYearId: replacement.academicYearId,
          studentId: replacement.studentId,
          admissionId: replacement.admissionId,
          programId: replacement.programId,
          academicUnitId: replacement.academicUnitId,
          enrollmentKind: replacement.enrollmentKind,
          originType: replacement.originType,
          previousEnrollmentId: input.enrollmentId,
        }),
        client,
      );

      // Attendance and marks hold rows against the *old* id. A create event
      // alone would tell them a new row exists but not that their own reference
      // has been retired.
      await this.outbox.enqueue(
        new EnrollmentSupersededEvent({
          oldEnrollmentId: input.enrollmentId,
          newEnrollmentId: replacement.id,
          organizationId: previous.organizationId,
          branchId: previous.branchId,
          academicYearId: previous.academicYearId,
          studentId: previous.studentId,
          originType: input.originType,
          changeReason: reason,
        }),
        client,
      );

      return { previous, current: replacement };
    };

    try {
      return tx ? await run(tx) : await this.prisma.$transaction(run);
    } catch (error) {
      throw this.translateConstraint(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Named operations
  // ---------------------------------------------------------------------------

  /**
   * Put a wrong placement right.
   *
   * `CORRECTION`, not `TRANSFER`: the student was never in the old class, and
   * conflating an operator's mistake with a real mid-year move destroys the
   * only evidence available when a registrar is asked why a child appears in
   * two class lists.
   */
  async correctPlacement(
    enrollmentId: string,
    input: {
      programId?: string;
      academicUnitId?: string;
      reason: string;
      expectedVersion?: number;
    },
    scope: ResourceScope,
    actor: EnrollmentActor,
  ) {
    return this.supersedeEnrollment(
      {
        enrollmentId,
        originType: EnrollmentOriginType.CORRECTION,
        closingStatus: EnrollmentStatus.SUPERSEDED,
        reason: input.reason,
        programId: input.programId,
        academicUnitId: input.academicUnitId,
        expectedVersion: input.expectedVersion,
      },
      scope,
      actor,
    );
  }

  /**
   * A real mid-year move, within the same branch.
   *
   * The old row closes as `SUPERSEDED`, exactly as a correction does, and what
   * separates the two is `originType`. That is not a shortcut: `TRANSFERRED` is
   * reserved for a *branch* transfer, whose replacement sits under a different
   * Admission — and it is deliberately **not** excluded from
   * `enrollment_one_primary_per_year`, so using it for a same-branch move would
   * leave the old row counting as live and make the replacement unwritable.
   *
   * **Cross-branch is not this operation and cannot be reached from here.** The
   * replacement's branch is copied from the row being replaced, so there is no
   * input that could move it; a branch change closes the Admission and opens a
   * new one, which is Phase 6's work.
   */
  async transferPlacement(
    enrollmentId: string,
    input: {
      programId?: string;
      academicUnitId?: string;
      rollNumber?: string | null;
      reason: string;
      expectedVersion?: number;
    },
    scope: ResourceScope,
    actor: EnrollmentActor,
  ) {
    return this.supersedeEnrollment(
      {
        enrollmentId,
        originType: EnrollmentOriginType.TRANSFER,
        closingStatus: EnrollmentStatus.SUPERSEDED,
        reason: input.reason,
        programId: input.programId,
        academicUnitId: input.academicUnitId,
        rollNumber: input.rollNumber,
        expectedVersion: input.expectedVersion,
      },
      scope,
      actor,
    );
  }

  /**
   * Void a placement.
   *
   * Never a delete. A cancelled enrolment stays visible with its date and its
   * reason, because "this student was placed here and it was undone" is a fact
   * somebody will need, and a missing row cannot express it.
   */
  async cancelEnrollment(
    enrollmentId: string,
    input: CancelEnrollmentInput,
    scope: ResourceScope,
    actor: EnrollmentActor,
  ): Promise<Enrollment> {
    const reason = this.requireReason(input.reason);

    await this.assertPermitted(actor, PERMISSIONS.Enrollment.Cancel);

    try {
      return await this.prisma.$transaction(async (client) => {
        const locked = await this.lockEnrollment(client, enrollmentId, scope);

        await this.assertAcademicYearOpen(
          client,
          locked.academicYearId as string,
          locked.branchId as string,
        );

        this.assertVersion(locked, input.expectedVersion);

        const currentStatus = locked.enrollmentStatus as EnrollmentStatus;

        if (!isLegalTransition(currentStatus, EnrollmentStatus.CANCELLED)) {
          throw new ConflictException({
            error: 'ENROLLMENT_CLOSED',
            message: `A placement in state ${currentStatus} cannot be cancelled.`,
            enrollmentStatus: currentStatus,
          });
        }

        this.assertNoRecordedResult(locked);

        const cancelled = await client.enrollment.update({
          where: { id: enrollmentId },
          data: {
            enrollmentStatus: EnrollmentStatus.CANCELLED,
            exitDate: input.exitDate ?? new Date(),
            exitReason: input.exitReason ?? 'CANCELLED_BEFORE_JOINING',
            changeReason: reason,
            updatedBy: actor.userId ?? null,
            version: { increment: 1 },
          },
        });

        await this.writeHistory(client, {
          enrollmentId,
          organizationId: cancelled.organizationId,
          branchId: cancelled.branchId,
          from: currentStatus,
          to: EnrollmentStatus.CANCELLED,
          actionType: 'CANCEL',
          remarks: reason,
          actor,
        });

        await this.outbox.enqueue(
          new EnrollmentStatusChangedEvent({
            enrollmentId,
            organizationId: cancelled.organizationId,
            branchId: cancelled.branchId,
            academicYearId: cancelled.academicYearId,
            studentId: cancelled.studentId,
            from: currentStatus,
            to: EnrollmentStatus.CANCELLED,
            reason,
          }),
          client,
        );

        return cancelled;
      });
    } catch (error) {
      throw this.translateConstraint(error);
    }
  }

  /**
   * Set or clear a class-register position.
   *
   * The one mutable field on an enrolment, and only until the class list locks.
   * It changes nothing about the placement: the student is in the same class
   * before and after, which is why this does not supersede the row.
   */
  async assignRollNumber(
    enrollmentId: string,
    input: AssignRollNumberInput,
    scope: ResourceScope,
    actor: EnrollmentActor,
  ): Promise<Enrollment> {
    await this.assertPermitted(actor, PERMISSIONS.Enrollment.RollNumberManage);

    if (input.rollNumber !== null) {
      this.assertRollNumberShape(input.rollNumber);
    }

    try {
      return await this.prisma.$transaction(async (client) => {
        const locked = await this.lockEnrollment(client, enrollmentId, scope);

        const yearLocked = await this.readAcademicYearLock(
          client,
          locked.academicYearId as string,
          locked.branchId as string,
        );

        // Two locks, one question. The academic year gates every write; the
        // class-list lock gates this one specifically, and today it derives
        // from the year until F2 provides a finer one.
        if (
          this.config.classListLocked(
            {
              organizationId: locked.organizationId as string,
              branchId: locked.branchId as string,
            },
            yearLocked,
            locked.academicUnitId as string,
          )
        ) {
          throw new ForbiddenException({
            error: 'CLASS_LIST_LOCKED',
            message:
              'The class list is locked; roll numbers can no longer be changed.',
            academicUnitId: locked.academicUnitId,
          });
        }

        this.assertVersion(locked, input.expectedVersion);

        const currentStatus = locked.enrollmentStatus as EnrollmentStatus;

        if (!isOpen(currentStatus)) {
          throw new ConflictException({
            error: 'ENROLLMENT_CLOSED',
            message: `A placement in state ${currentStatus} keeps the roll number it had.`,
            enrollmentStatus: currentStatus,
          });
        }

        const from = (locked.rollNumber as string | null) ?? null;
        const to = input.rollNumber?.trim() || null;

        const updated = await client.enrollment.update({
          where: { id: enrollmentId },
          data: {
            rollNumber: to,
            updatedBy: actor.userId ?? null,
            version: { increment: 1 },
          },
        });

        await this.outbox.enqueue(
          new EnrollmentRollNumberChangedEvent({
            enrollmentId,
            organizationId: updated.organizationId,
            branchId: updated.branchId,
            academicYearId: updated.academicYearId,
            academicUnitId: updated.academicUnitId,
            studentId: updated.studentId,
            from,
            to,
          }),
          client,
        );

        return updated;
      });
    } catch (error) {
      throw this.translateConstraint(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  /** One placement, within the caller's scope. Out of scope reads as absent. */
  async findById(id: string, scope: ResourceScope): Promise<Enrollment> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        deletedAt: null,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    return enrollment;
  }

  /**
   * The placement a student currently holds.
   *
   * The reason Student carries no `currentEnrollmentId`: a stored pointer has
   * to be rewritten on every promotion, correction and transfer, and the one
   * that is missed is a student the system believes is in a class they left.
   * At most one row can come back — the partial unique index guarantees it.
   */
  async findCurrent(
    studentId: string,
    academicYearId: string,
    scope: ResourceScope,
  ): Promise<Enrollment | null> {
    return this.prisma.enrollment.findFirst({
      where: {
        studentId,
        academicYearId,
        organizationId: scope.organizationId,
        enrollmentKind: EnrollmentKind.PRIMARY,
        enrollmentStatus: {
          in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.ON_BREAK],
        },
        deletedAt: null,
      },
    });
  }

  /** Filtered list — the class register, the branch headcount, the history. */
  async search(params: EnrollmentSearchParams, scope: ResourceScope) {
    const limit = Math.min(
      params.limit ?? ENROLLMENT_SEARCH_DEFAULT_LIMIT,
      ENROLLMENT_SEARCH_MAX_LIMIT,
    );

    const where: Prisma.EnrollmentWhereInput = {
      organizationId: scope.organizationId,
      branchId: scope.branchId,
      deletedAt: null,
      ...(params.studentId ? { studentId: params.studentId } : {}),
      ...(params.admissionId ? { admissionId: params.admissionId } : {}),
      ...(params.academicYearId
        ? { academicYearId: params.academicYearId }
        : {}),
      ...(params.programId ? { programId: params.programId } : {}),
      ...(params.academicUnitId
        ? { academicUnitId: params.academicUnitId }
        : {}),
      ...(params.enrollmentStatus
        ? { enrollmentStatus: params.enrollmentStatus }
        : {}),
      ...(params.enrollmentKind
        ? { enrollmentKind: params.enrollmentKind }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        orderBy: [{ academicYearId: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: params.offset ?? 0,
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    return { items, total, limit, offset: params.offset ?? 0 };
  }

  /**
   * A student's whole placement history, oldest first.
   *
   * Organization-scoped rather than branch-scoped: a student who transferred
   * between branches has history in both, and a branch filter here would
   * silently truncate the record that a transfer certificate is written from.
   */
  async findByStudent(studentId: string, scope: ResourceScope) {
    return this.prisma.enrollment.findMany({
      where: {
        studentId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Every year of one spell of study. */
  async findByAdmission(admissionId: string, scope: ResourceScope) {
    return this.prisma.enrollment.findMany({
      where: {
        admissionId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Transition history for one placement, newest first. */
  async getHistory(enrollmentId: string, scope: ResourceScope) {
    await this.findById(enrollmentId, scope);

    return this.prisma.workflowHistory.findMany({
      where: {
        entityType: 'ENROLLMENT',
        entityId: enrollmentId,
        organizationId: scope.organizationId,
        branchId: scope.branchId,
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------

  /**
   * Lock the placement, then decide.
   *
   * `findFirst` takes no lock, so a service that reads a status, checks it and
   * then writes is racing every other caller doing the same. Under `READ
   * COMMITTED` a blocked `FOR UPDATE` re-reads after the winner commits, which
   * is what makes the state check below meaningful rather than decorative.
   */
  private async lockEnrollment(
    client: PrismaTransactionClient,
    enrollmentId: string,
    scope: ResourceScope,
  ): Promise<LockedEnrollment> {
    const locked = await this.rowLock.lockRow(client, {
      table: 'Enrollment',
      id: enrollmentId,
      scope: {
        organizationId: scope.organizationId,
        branchId: scope.branchId,
      },
      columns: LOCKED_COLUMNS,
    });

    if (!locked || locked.deletedAt !== null) {
      // Out of scope is indistinguishable from absent, deliberately: a 403
      // would confirm the row exists to someone not entitled to know.
      throw new NotFoundException('Enrollment not found');
    }

    return locked;
  }

  /**
   * Read the year's lock state, holding it still for the transaction.
   *
   * `FOR SHARE`, not `FOR UPDATE`. The share lock blocks the `UPDATE` that sets
   * `isLocked` — so an administrator locking the year while a correction is in
   * flight waits for the correction and then succeeds, and the correction
   * cannot commit into a year that closed underneath it. An exclusive lock here
   * would serialise every enrolment write in the year behind one row for no
   * additional guarantee.
   */
  private async readAcademicYearLock(
    client: PrismaTransactionClient,
    academicYearId: string,
    branchId: string,
  ): Promise<boolean> {
    const year = await this.rowLock.lockRow(client, {
      table: 'AcademicYear',
      id: academicYearId,
      scope: { branchId },
      columns: ['isLocked', 'isDeleted'],
      mode: 'SHARE',
    });

    if (!year || year.isDeleted === true) {
      throw new NotFoundException('Academic year not found');
    }

    return year.isLocked === true;
  }

  /**
   * No write lands in a locked year (INV-ENR-011).
   *
   * Checked in the service and inside the transaction, never from a value the
   * client supplied: a caller does not get to tell the server whether the year
   * it is writing into is open.
   */
  private async assertAcademicYearOpen(
    client: PrismaTransactionClient,
    academicYearId: string,
    branchId: string,
  ): Promise<boolean> {
    const locked = await this.readAcademicYearLock(
      client,
      academicYearId,
      branchId,
    );

    if (locked) {
      throw new ForbiddenException({
        error: 'ACADEMIC_YEAR_LOCKED',
        message:
          'The academic year is locked and cannot accept placement changes.',
        academicYearId,
      });
    }

    return locked;
  }

  private async assertPermitted(
    actor: EnrollmentActor,
    permission: string,
  ): Promise<void> {
    if (actor.system) return;

    if (!actor.userId || !actor.role) {
      throw new ForbiddenException({
        error: 'ForbiddenException',
        message: 'This action requires an authenticated user.',
      });
    }

    const permitted = await this.authorization.hasPermission(
      actor.userId,
      actor.role as RoleType,
      permission,
    );

    if (!permitted) {
      throw new ForbiddenException({
        error: 'ForbiddenException',
        message: 'You do not have permission to perform this action.',
      });
    }
  }

  /**
   * Optimistic version check.
   *
   * Only when the caller states an expectation. A client that read the row,
   * showed it to a user and is now submitting a change can say which version it
   * was looking at; a server-side orchestrator that just locked the row has no
   * stale copy to guard against and passes nothing.
   */
  private assertVersion(
    locked: LockedEnrollment,
    expectedVersion?: number,
  ): void {
    if (expectedVersion === undefined) return;

    if (locked.version !== expectedVersion) {
      throw new ConflictException({
        error: 'STALE_ENROLLMENT_VERSION',
        message:
          'This placement changed after it was read. Reload it and try again.',
        expectedVersion,
        currentVersion: locked.version,
      });
    }
  }

  /**
   * Blank is not a reason.
   *
   * `reason != null` accepts `""` and `"   "`, which is how a mandatory-reason
   * field becomes a mandatory-keystroke field. The CHECK constraint enforces
   * the same rule at the database, so a raw write cannot get around it either.
   */
  private requireReason(reason: string | null | undefined): string {
    const trimmed = reason?.trim();

    if (!trimmed) {
      throw new BadRequestException({
        error: 'CHANGE_REASON_REQUIRED',
        message: 'A reason is required to change a placement.',
      });
    }

    return trimmed;
  }

  private assertRollNumberShape(rollNumber: string): void {
    if (!rollNumber.trim()) {
      throw new BadRequestException({
        error: 'ROLL_NUMBER_INVALID',
        message: 'A roll number cannot be blank. Send null to clear it.',
      });
    }
  }

  /**
   * A placement with a result recorded against it is not cancelled.
   *
   * Examination owns `resultOutcome` and Enrollment only reads it here — which
   * is the correct direction: cancelling a year a student has already been
   * examined for would leave marks pointing at a placement that officially
   * never happened.
   */
  private assertNoRecordedResult(locked: LockedEnrollment): void {
    if (locked.resultOutcome != null) {
      throw new ConflictException({
        error: 'ENROLLMENT_HAS_RESULT',
        message:
          'A result has been recorded against this placement, so it can no longer be cancelled.',
      });
    }
  }

  private async writeHistory(
    client: PrismaTransactionClient,
    entry: {
      enrollmentId: string;
      organizationId: string;
      branchId: string;
      from: EnrollmentStatus | null;
      to: EnrollmentStatus;
      actionType: string;
      remarks: string | null;
      actor: EnrollmentActor;
    },
  ): Promise<void> {
    await client.workflowHistory.create({
      data: {
        organizationId: entry.organizationId,
        branchId: entry.branchId,
        entityType: 'ENROLLMENT',
        entityId: entry.enrollmentId,
        oldStatus: entry.from,
        newStatus: entry.to,
        actionType: entry.actionType,
        remarks: entry.remarks,
        actionBy: entry.actor.system
          ? 'SYSTEM'
          : (entry.actor.userId ?? 'SYSTEM'),
      },
    });
  }

  /**
   * Say which rule the database enforced.
   *
   * A raw `P2002` naming `enrollment_one_primary_per_year` tells the caller
   * nothing they can act on, and leaking an index name is a detail of the
   * schema that the API contract does not owe them.
   *
   * Matched on the *columns* as well as the index name, because Prisma reports
   * a partial unique index by its key columns rather than by the name the
   * migration gave it — a distinction that only shows up against a real
   * database, and silently lets the raw error escape if only the name is
   * checked.
   */
  private translateConstraint(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const meta = (error.meta ?? {}) as { target?: string | string[] };
      const target = Array.isArray(meta.target)
        ? meta.target.join(',')
        : String(meta.target ?? '');
      const hits = (...columns: string[]) =>
        columns.every((column) => target.includes(column));

      if (error.code === UNIQUE_VIOLATION) {
        if (
          target.includes('enrollment_one_primary_per_year') ||
          hits('admissionId', 'academicYearId')
        ) {
          return new ConflictException({
            error: 'ENROLLMENT_EXISTS_FOR_YEAR',
            message:
              'This admission already has a live placement for that academic year.',
          });
        }
        if (
          target.includes('enrollment_rollno_unique') ||
          hits('academicUnitId', 'rollNumber')
        ) {
          return new ConflictException({
            error: 'ROLL_NUMBER_TAKEN',
            message:
              'That roll number is already used in this class this year.',
          });
        }
        if (target.includes('supersededById')) {
          return new ConflictException({
            error: 'ENROLLMENT_ALREADY_SUPERSEDED',
            message: 'This placement has already been replaced.',
          });
        }
      }

      if (error.code === FK_VIOLATION) {
        // The composite keys make a mismatched student, branch, programme or
        // year unrepresentable; Postgres reports all four the same way.
        return new BadRequestException({
          error: 'ACADEMIC_UNIT_MISMATCH',
          message:
            'The placement references a student, branch, programme, academic unit or year that do not belong together.',
        });
      }
    }

    if (this.isCheckViolation(error)) {
      return new BadRequestException({
        error: 'ENROLLMENT_INVALID',
        message: 'The placement violates an integrity rule.',
      });
    }

    return error;
  }

  private isCheckViolation(error: unknown): boolean {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '';
    return /violates check constraint "enrollment_/.test(message);
  }
}
