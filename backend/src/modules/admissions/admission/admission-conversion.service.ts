import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionApplicationStatus,
  AdmissionType,
  Prisma,
  RoleType,
} from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { RowLockService } from '@/infrastructure/database/row-lock.service';
import { PersonService } from '@/modules/identity/person/person.service';
import { StudentService } from '@/modules/identity/student/student.service';
import { EnrollmentService } from '@/modules/enrollment/enrollment.service';
import { GuardianshipService } from '../guardians/guardianship.service';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { ResourceScope } from '@/common/scope/resource-scope';
import { AdmissionService } from './admission.service';
import {
  DIRECT_ADMISSION_PERMISSIONS,
  WorkflowService,
} from '../workflow/workflow.service';
import {
  DIRECT_ADMISSION_PLAN,
  WorkflowAction,
} from '../workflow/workflow.transitions';

/** Who is admitting, and with what authority. */
export interface AdmitActor {
  userId?: string | null;
  role?: string | null;
}

export interface AdmitRequest {
  /**
   * The section (or whichever unit type the institution uses as its leaf) the
   * student is placed into.
   *
   * Supplied by the caller because it is genuinely not known earlier: an
   * applicant applies to a *programme* — "Std 1" — and which *section* they
   * join is the decision being made at this moment. `Applicant` carries no
   * academic unit for that reason, and inventing one here would be guessing at
   * a placement a registrar has not made.
   */
  academicUnitId: string;
  /** The academic nature of the entry. `REGULAR` unless stated otherwise. */
  admissionType?: AdmissionType;
  /** The joining date. Defaults to now; a back-dated entry states its own. */
  admissionDate?: Date;
  remarks?: string | null;
}

export interface AdmitResult {
  studentId: string;
  studentCode: string;
  admissionId: string;
  admissionNo: string;
  enrollmentId: string;
  applicantId: string;
}

export interface DirectAdmitResult extends AdmitResult {
  /** The workflow actions walked before `admit`, in order. */
  walked: WorkflowAction[];
}

/**
 * Entry kinds a first admission may legitimately record.
 *
 * `READMISSION` and `BRANCH_TRANSFER` are excluded because both begin from a
 * Student that already exists and a previous Admission that has to be closed
 * first — they are operations in their own right, not a value a caller may
 * select here. `TRANSFER` and `MIGRATION` are likewise the importer's and the
 * transfer workflow's to write.
 */
const FIRST_ENTRY_TYPES: readonly AdmissionType[] = [
  'REGULAR',
  'LATERAL_ENTRY',
  'RTE',
];

/**
 * Applicant → Student → Admission → Enrollment, in one transaction.
 *
 * The keystone operation of the whole domain, and the only place where a
 * learner identity is born from an application. Everything it writes commits
 * together or not at all: there is no state in which a Student exists without
 * the Admission that explains why, or an applicant reads `ADMITTED` with
 * nothing behind them.
 *
 * ## An orchestrator, not an owner
 *
 * It writes nothing itself. Person resolution, student identity, the spell of
 * study and the academic placement each belong to a service that knows its own
 * rules, and this composes them on **one** transaction client:
 *
 * ```
 * admit()
 *   └── $transaction(tx)
 *        ├── lock the Applicant          ← first statement, always
 *        ├── PersonService.resolve(…, tx)
 *        ├── StudentService.createControlled(…, tx)
 *        ├── AdmissionService.createControlled(…, tx)
 *        ├── EnrollmentService.createInitialEnrollment(…, tx)
 *        └── WorkflowService.transition(…, tx)
 * ```
 *
 * Each of those opens its own transaction when called alone and joins this one
 * when given `tx`. A service that silently ignored the client it was passed is
 * the single most common way an "atomic" operation turns out not to be, which
 * is why there is a test asserting exactly that for all four.
 *
 * ## What it deliberately cannot do
 *
 * Reuse an existing Student. The architecture's step 5b — find the Student for
 * this Person and open a second Admission — *is* readmission (§23), and
 * readmission has guards this operation does not implement: an expelled student
 * needs an elevated permission, a returning one needs their previous admission
 * closed, and a mandatory reason is recorded. Rather than implement a partial
 * version of it under another name, an existing Student produces a conflict
 * naming what already exists.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §31.1.
 */
@Injectable()
export class AdmissionConversionService {
  private readonly logger = new Logger(AdmissionConversionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLock: RowLockService,
    private readonly persons: PersonService,
    private readonly students: StudentService,
    private readonly admissions: AdmissionService,
    private readonly enrollments: EnrollmentService,
    private readonly workflow: WorkflowService,
    private readonly authorization: AuthorizationService,
    private readonly guardianships: GuardianshipService,
  ) {}

  /**
   * Admit a seat-confirmed applicant.
   *
   * Validation that cannot change under us happens before the transaction, so
   * neither the applicant row nor the numbering counters are held while it
   * runs. Everything that *can* change concurrently — the applicant's status
   * above all — is re-read inside, after the lock.
   */
  async admit(
    applicantId: string,
    request: AdmitRequest,
    scope: ResourceScope,
    actor: AdmitActor,
  ): Promise<AdmitResult> {
    await this.assertPermitted(actor);
    const admissionType = this.firstEntryType(request);

    // Read-only and cheap to repeat, so it stays outside: every statement in
    // here would otherwise extend the lock hold on the applicant row.
    const applicant = await this.loadApplicant(applicantId, scope);
    await this.assertSeatConfirmed(applicant);
    const placement = await this.resolvePlacement(applicant, request);
    await this.assertNumberingProvisioned(applicant);

    try {
      return await this.prisma.$transaction(
        async (tx) =>
          this.convert(tx, applicant, placement, admissionType, request, actor),
        { timeout: 15_000 },
      );
    } catch (error) {
      throw await this.translate(error, applicantId);
    }
  }

  /**
   * SIMPLE_ADMISSION: take an application from wherever it is on the spine
   * to `ADMITTED` in one transaction.
   *
   * It is `admit()` preceded by the ordinary workflow steps it would
   * otherwise need — submit, startReview, approve, confirmSeat, whichever
   * remain — each run through `WorkflowService.transition` on the same
   * transaction client. Nothing is skipped: every step checks its own
   * permission and guards (the document checklist included), stamps its
   * timestamps, writes its history row and enqueues its event; Person
   * resolution happens in `submit` exactly as it always does; and the
   * conversion is the same `convert()` that `admit()` runs. There is no edge
   * from DRAFT to ADMITTED and none was added.
   *
   * Any failure anywhere rolls back every step, so the applicant is left
   * exactly as it was found.
   */
  async directAdmit(
    applicantId: string,
    request: AdmitRequest,
    scope: ResourceScope,
    actor: AdmitActor,
  ): Promise<DirectAdmitResult> {
    await this.assertPermitted(actor, DIRECT_ADMISSION_PERMISSIONS);
    const admissionType = this.firstEntryType(request);

    // Pre-flight, outside the lock — the same checks admit() makes, plus the
    // profile. All of it is repeated or re-derived under the lock below.
    const applicant = await this.loadApplicant(applicantId, scope);
    await this.assertDirectAdmissionProfile(applicant, applicant.submittedAt);
    if (DIRECT_ADMISSION_PLAN[applicant.admissionStatus] === undefined) {
      throw await this.explainNotDirectlyAdmissible(
        this.prisma,
        applicant.id,
        applicant.admissionStatus,
      );
    }
    await this.resolvePlacement(applicant, request);
    await this.assertNumberingProvisioned(applicant);

    const lineage: ResourceScope = {
      organizationId: applicant.organizationId,
      branchId: applicant.branchId,
      academicYearId: applicant.academicYearId,
    };

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const locked = await this.rowLock.lockRow(tx, {
            table: 'Applicant',
            id: applicant.id,
            scope: {
              organizationId: applicant.organizationId,
              branchId: applicant.branchId,
            },
            columns: ['admissionStatus', 'deletedAt', 'submittedAt'],
          });

          if (!locked || locked.deletedAt !== null) {
            throw new NotFoundException('Applicant not found');
          }

          // The pre-flight read was a guess; this is the state that counts.
          const current = locked.admissionStatus as AdmissionApplicationStatus;
          await this.assertDirectAdmissionProfile(
            applicant,
            (locked.submittedAt as Date | null) ?? null,
          );
          const plan = DIRECT_ADMISSION_PLAN[current];
          if (plan === undefined) {
            throw await this.explainNotDirectlyAdmissible(
              tx,
              applicant.id,
              current,
            );
          }

          for (const action of plan) {
            await this.workflow.transition(
              applicant.id,
              { action, orchestration: 'DIRECT_ADMISSION' },
              lineage,
              { userId: actor.userId, role: actor.role },
              tx,
            );
          }

          // A draft was editable until the lock was taken, and submission has
          // just resolved its Person: convert from the row as it now stands.
          const fresh = await this.loadApplicant(applicant.id, scope, tx);
          const placement = await this.resolvePlacement(fresh, request);

          const result = await this.convert(
            tx,
            fresh,
            placement,
            admissionType,
            request,
            actor,
            'DIRECT_ADMISSION',
          );
          return { ...result, walked: [...plan] };
        },
        { timeout: 15_000 },
      );
    } catch (error) {
      throw await this.translate(error, applicantId);
    }
  }

  // ---------------------------------------------------------------------------

  private async convert(
    tx: PrismaTransactionClient,
    applicant: LoadedApplicant,
    placement: ResolvedPlacement,
    admissionType: AdmissionType,
    request: AdmitRequest,
    actor: AdmitActor,
    orchestration?: 'DIRECT_ADMISSION',
  ): Promise<AdmitResult> {
    // 1. Lock first. Two registrars clicking Admit at the same moment both read
    //    SEAT_CONFIRMED without this, and both proceed.
    const locked = await this.rowLock.lockRow(tx, {
      table: 'Applicant',
      id: applicant.id,
      scope: {
        organizationId: applicant.organizationId,
        branchId: applicant.branchId,
      },
      columns: ['admissionStatus', 'deletedAt', 'personId'],
    });

    if (!locked || locked.deletedAt !== null) {
      throw new NotFoundException('Applicant not found');
    }

    // 2. Re-assert the state under the lock. The read before the transaction is
    //    a guess: a competing admit, a cancellation or the offer-expiry sweep
    //    may have committed in between, and this is where that becomes visible.
    const current = locked.admissionStatus as AdmissionApplicationStatus;

    if (current !== 'SEAT_CONFIRMED') {
      throw await this.explainIneligible(tx, applicant.id, current);
    }

    // 3. Identity.
    //
    //    The application was placed in the identity index at submission, and
    //    that Person is the answer — re-resolving here would ask the same
    //    question twice and get a different answer for anyone without a
    //    government identifier, because demographic matching deliberately never
    //    merges (twins share every demographic signal). The result would be two
    //    Person rows for one human, with the Applicant pointing at the first and
    //    the Student at the second.
    //
    //    Resolution therefore runs only for a row that predates the identity
    //    index, and is delegated entirely when it does: admissions does no
    //    matching of its own, and the government identifier travels through the
    //    Person abstraction rather than being read, logged or copied here.
    const personId =
      (locked.personId as string | null) ??
      (
        await this.persons.resolve(
          applicant.organizationId,
          {
            firstName: applicant.firstName,
            middleName: applicant.middleName,
            lastName: applicant.lastName,
            dob: applicant.dob,
            phone: applicant.primaryMobile,
            governmentId: applicant.aadhaarNo,
          },
          tx,
        )
      ).personId;

    // 4. An existing Student for this Person is readmission, not admission.
    await this.assertNoExistingStudent(tx, applicant.organizationId, personId);

    // 5. Student. The code is allocated inside `createControlled`, from the
    //    organization's MONOTONIC sequence.
    const student = await this.students.createControlled(
      {
        organizationId: applicant.organizationId,
        branchId: applicant.branchId,
        personId,
        firstName: applicant.firstName,
        middleName: applicant.middleName,
        lastName: applicant.lastName,
        dob: applicant.dob,
        genderId: applicant.genderId,
        religionId: applicant.religionId,
        casteId: applicant.casteId,
        categoryId: applicant.categoryId,
        motherTongueId: applicant.motherTongueId,
        bloodGroupId: applicant.bloodGroupId,
        disabilityStatus: applicant.disabilityStatus,
        disabilityTypeId: applicant.disabilityTypeId,
        primaryMobile: applicant.primaryMobile,
        primaryEmail: applicant.primaryEmail,
        apaarId: applicant.apaarId,
        penNo: applicant.penNo,
        createdVia: 'ADMISSION',
        sourceApplicantId: applicant.id,
        // Numbering context only, per admissionAcademicYearId's own doc —
        // this is the applicant's academic year, not a field Student stores.
        admissionAcademicYearId: applicant.academicYearId,
        createdBy: actor.userId ?? null,
      },
      tx,
    );

    // 5.5. Project this applicant's guardian mappings onto the persistent
    //      Guardianship (§8.3). The ward's Person is guaranteed resolved here
    //      even for mappings created before the applicant itself had a
    //      personId — the case `mapGuardianToApplicant` cannot sync at map
    //      time. Guardians with no personId are skipped, not errored: a
    //      guardian profile with no linked Person is a normal state.
    await this.guardianships.syncFromApplicantMappings(
      tx,
      applicant.id,
      applicant.organizationId,
      personId,
    );

    // 6. The spell of study. `admissionNo` comes from the branch sequence.
    const admission = await this.admissions.createControlled(
      {
        organizationId: applicant.organizationId,
        branchId: applicant.branchId,
        studentId: student.id,
        admissionType,
        admissionDate: request.admissionDate ?? new Date(),
        entryProgramId: placement.programId,
        entryAcademicUnitId: placement.academicUnitId,
        academicYearId: applicant.academicYearId,
        quotaId: applicant.quotaId,
        admissionSourceId: applicant.admissionSourceId,
        sourceApplicantId: applicant.id,
        createdBy: actor.userId ?? null,
      },
      tx,
    );

    // 7. The first academic placement. Its scope comes from the Admission's
    //    lineage, not from the request context.
    const enrollment = await this.enrollments.createInitialEnrollment(
      {
        organizationId: applicant.organizationId,
        branchId: applicant.branchId,
        academicYearId: applicant.academicYearId,
        admissionId: admission.id,
        studentId: student.id,
        programId: placement.programId,
        academicUnitId: placement.academicUnitId,
        originType: 'ADMISSION',
        // Left unset: the roll number is a class-register position and the
        // default policy is manual. Inventing one at admission would produce a
        // number nobody can explain.
        applicantId: applicant.id,
        createdBy: actor.userId ?? null,
      },
      tx,
    );

    // 8. Only now does the application change state — through the machine, on
    //    this transaction, so the status and the three rows behind it commit
    //    together or not at all.
    await this.workflow.transition(
      applicant.id,
      {
        action: WorkflowAction.ADMIT,
        remarks: request.remarks,
        orchestrated: true,
        ...(orchestration ? { orchestration } : {}),
      },
      {
        organizationId: applicant.organizationId,
        branchId: applicant.branchId,
        academicYearId: applicant.academicYearId,
      },
      { userId: actor.userId, role: actor.role },
      tx,
    );

    this.logger.log(
      `Admitted applicant ${applicant.id} as student ${student.studentCode}.`,
    );

    return {
      studentId: student.id,
      studentCode: student.studentCode,
      admissionId: admission.id,
      admissionNo: admission.admissionNo,
      enrollmentId: enrollment.id,
      applicantId: applicant.id,
    };
  }

  // ---------------------------------------------------------------------------
  // Pre-transaction validation
  // ---------------------------------------------------------------------------

  /**
   * The applicant, within the caller's scope.
   *
   * Loads the columns the conversion needs and no more. The guardians, the
   * documents and the preference list are not read: they are not part of this
   * operation, and loading them would put an unbounded graph in front of a
   * transaction that is about to take a lock.
   */
  private async loadApplicant(
    applicantId: string,
    scope: ResourceScope,
    client: PrismaTransactionClient | PrismaService = this.prisma,
  ): Promise<LoadedApplicant> {
    const applicant = await client.applicant.findFirst({
      where: {
        id: applicantId,
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        branchId: true,
        academicYearId: true,
        admissionStatus: true,
        programId: true,
        personId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        dob: true,
        genderId: true,
        religionId: true,
        casteId: true,
        categoryId: true,
        motherTongueId: true,
        bloodGroupId: true,
        disabilityStatus: true,
        disabilityTypeId: true,
        primaryMobile: true,
        primaryEmail: true,
        apaarId: true,
        penNo: true,
        aadhaarNo: true,
        quotaId: true,
        admissionSourceId: true,
        submittedAt: true,
      },
    });

    if (!applicant) {
      // Out of scope is indistinguishable from absent: a 403 would confirm that
      // an applicant with this id exists somewhere.
      throw new NotFoundException('Applicant not found');
    }

    return applicant;
  }

  private async assertSeatConfirmed(applicant: LoadedApplicant): Promise<void> {
    if (applicant.admissionStatus !== 'SEAT_CONFIRMED') {
      // The same explanation the in-transaction check gives, so a plain retry
      // and a lost race produce the same answer. The retry is the common case
      // and is exactly where naming the existing student is most useful.
      throw await this.explainIneligible(
        this.prisma,
        applicant.id,
        applicant.admissionStatus,
      );
    }
  }

  /**
   * Where the student will sit.
   *
   * The programme is the applicant's own — it is what they were offered and
   * confirmed, and it is not the caller's to change at this point. The academic
   * unit is the caller's, because nothing earlier in the funnel records a
   * section. Requiring the unit's programme to match the applicant's is what
   * stops a placement quietly moving a child to a different course.
   */
  private async resolvePlacement(
    applicant: LoadedApplicant,
    request: AdmitRequest,
  ): Promise<ResolvedPlacement> {
    if (!applicant.programId) {
      throw new BadRequestException({
        error: 'PROGRAM_REQUIRED',
        message:
          'This application has no programme, so there is nothing to admit the student into.',
      });
    }

    const unit = await this.prisma.academicUnit.findFirst({
      where: { id: request.academicUnitId, isDeleted: false },
      select: {
        id: true,
        branchId: true,
        programId: true,
        academicYearId: true,
        isActive: true,
      },
    });

    if (!unit) {
      throw new NotFoundException({
        error: 'ACADEMIC_UNIT_NOT_FOUND',
        message: 'The academic unit does not exist.',
      });
    }

    if (
      unit.branchId !== applicant.branchId ||
      unit.academicYearId !== applicant.academicYearId ||
      unit.programId !== applicant.programId
    ) {
      throw new BadRequestException({
        error: 'ACADEMIC_UNIT_MISMATCH',
        message:
          "The academic unit does not belong to the application's branch, academic year and programme.",
      });
    }

    if (!unit.isActive) {
      throw new BadRequestException({
        error: 'ACADEMIC_UNIT_INACTIVE',
        message: 'The academic unit is not active.',
      });
    }

    // A unit with children is a structural node — "Grade 1" — not the place a
    // learner actually sits. EnrollmentService enforces this too, inside the
    // transaction; checked here as well so a caller gets the same named error
    // without an unnecessary transaction being opened first.
    const childCount = await this.prisma.academicUnit.count({
      where: { parentId: unit.id, isDeleted: false },
    });

    if (childCount > 0) {
      throw new BadRequestException({
        error: 'ACADEMIC_UNIT_NOT_PLACEMENT_TARGET',
        message:
          'This academic unit has child units and is not a valid placement target. Select the specific division, section or batch the student joins.',
      });
    }

    const year = await this.prisma.academicYear.findFirst({
      where: { id: applicant.academicYearId, isDeleted: false },
      select: { id: true, isLocked: true, branchId: true },
    });

    if (!year || year.branchId !== applicant.branchId) {
      throw new NotFoundException('Academic year not found');
    }

    if (year.isLocked) {
      // Checked here for a clean error, and again inside the transaction by
      // EnrollmentService under a share lock — this read is not the guarantee.
      throw new ForbiddenException({
        error: 'ACADEMIC_YEAR_LOCKED',
        message:
          'The academic year is locked and cannot accept new placements.',
        academicYearId: applicant.academicYearId,
      });
    }

    return { programId: applicant.programId, academicUnitId: unit.id };
  }

  /**
   * Both sequences must already be provisioned.
   *
   * A missing configuration is a tenant-onboarding failure, not something to
   * invent at admission time: a code minted from a default nobody configured is
   * a permanent identifier in the wrong format, printed on an ID card before
   * anyone notices.
   */
  private async assertNumberingProvisioned(
    applicant: LoadedApplicant,
  ): Promise<void> {
    const configs = await this.prisma.numberSequenceConfig.findMany({
      where: {
        organizationId: applicant.organizationId,
        purpose: { in: ['STUDENT_CODE', 'ADMISSION_NO'] },
        deletedAt: null,
        // Matches `NumberingService.requireConfig`'s own filter exactly. A
        // deactivated-but-undeleted config previously passed this check and
        // then failed deterministically at `numbering.allocate()` inside the
        // transaction — not a race, a guaranteed 500 on every admit attempt
        // for that organization until someone noticed.
        isActive: true,
        OR: [{ branchId: null }, { branchId: applicant.branchId }],
      },
      select: { purpose: true },
    });

    const present = new Set(configs.map((c) => c.purpose));
    const missing = (['STUDENT_CODE', 'ADMISSION_NO'] as const).filter(
      (purpose) => !present.has(purpose),
    );

    if (missing.length > 0) {
      throw new BadRequestException({
        error: 'NUMBERING_NOT_PROVISIONED',
        message:
          'This organization is not provisioned to issue student codes or admission numbers. Configure the sequences before admitting.',
        missing,
      });
    }
  }

  private async assertPermitted(
    actor: AdmitActor,
    permissions: readonly string[] = [
      PERMISSIONS.Admissions.Approve,
      PERMISSIONS.Student.Create,
    ],
  ): Promise<void> {
    if (!actor.userId || !actor.role) {
      throw new ForbiddenException({
        error: 'ForbiddenException',
        message: 'This action requires an authenticated user.',
      });
    }

    // All, not any. Approving a form and minting a permanent learner
    // identity are different powers, and admission exercises both at once; a
    // direct admission also submits and confirms, so it needs update too.
    for (const permission of permissions) {
      const permitted = await this.authorization.hasPermission(
        actor.userId,
        actor.role as RoleType,
        permission,
      );

      if (!permitted) {
        throw new ForbiddenException({
          error: 'ForbiddenException',
          message: 'You do not have permission to admit an applicant.',
        });
      }
    }
  }

  private firstEntryType(request: AdmitRequest): AdmissionType {
    const admissionType = request.admissionType ?? 'REGULAR';
    if (!FIRST_ENTRY_TYPES.includes(admissionType)) {
      throw new BadRequestException({
        error: 'ADMISSION_TYPE_NOT_A_FIRST_ENTRY',
        message: `${admissionType} begins from an existing student and a previous spell of study. It is its own operation, not an admission type this one accepts.`,
        allowed: FIRST_ENTRY_TYPES,
      });
    }
    return admissionType;
  }

  /**
   * Direct admission belongs to SIMPLE_ADMISSION alone, resolved from
   * configuration as of the application's submission (or now, for a draft) —
   * never from the request.
   */
  private async assertDirectAdmissionProfile(
    applicant: LoadedApplicant,
    submittedAt: Date | null,
  ): Promise<void> {
    const policy = await this.workflow.policyFor(
      {
        organizationId: applicant.organizationId,
        branchId: applicant.branchId,
        academicYearId: applicant.academicYearId,
      },
      submittedAt,
    );
    if (policy.workflowProfile !== 'SIMPLE_ADMISSION') {
      throw new BadRequestException({
        error: 'WORKFLOW_PROFILE_MISMATCH',
        message: `Direct admission is available only under the SIMPLE_ADMISSION profile. This application follows ${policy.workflowProfile}; use the standard workflow.`,
        profile: policy.workflowProfile,
      });
    }
  }

  private async explainNotDirectlyAdmissible(
    client: PrismaTransactionClient | PrismaService,
    applicantId: string,
    current: AdmissionApplicationStatus,
  ): Promise<Error> {
    if (current === 'ADMITTED') {
      return this.explainIneligible(client, applicantId, current);
    }
    return new BadRequestException({
      error: 'INVALID_TRANSITION',
      message: `An application in state ${current} cannot be directly admitted.`,
      from: current,
      action: 'directAdmit',
      allowedFrom: Object.keys(DIRECT_ADMISSION_PLAN),
    });
  }

  // ---------------------------------------------------------------------------
  // In-transaction guards
  // ---------------------------------------------------------------------------

  /**
   * Name what already happened, when the state has moved on.
   *
   * A bare "not seat confirmed" is unhelpful for the common case, which is that
   * a concurrent request already admitted this applicant a moment ago. Telling
   * the loser which student now exists lets a client treat the conflict as the
   * completed operation it is.
   */
  private async explainIneligible(
    tx: PrismaTransactionClient | PrismaService,
    applicantId: string,
    current: AdmissionApplicationStatus,
  ): Promise<Error> {
    if (current !== 'ADMITTED') {
      return new ConflictException({
        error: 'APPLICANT_NOT_SEAT_CONFIRMED',
        message: `An application must have a confirmed seat before it can be admitted. This one is ${current}.`,
        currentStatus: current,
      });
    }

    const student = await tx.student.findFirst({
      where: { sourceApplicantId: applicantId },
      select: { id: true, studentCode: true },
    });

    const { admissionId, enrollmentId } = student
      ? await this.findActiveAdmissionAndEnrollment(tx, student.id)
      : { admissionId: null, enrollmentId: null };

    return new ConflictException({
      error: 'APPLICANT_ALREADY_ADMITTED',
      message: 'This application has already been converted to a student.',
      // Identifiers only. A code is designed to be printed; nothing here
      // reveals anything about the person behind it.
      studentId: student?.id ?? null,
      studentCode: student?.studentCode ?? null,
      admissionId,
      enrollmentId,
    });
  }

  /**
   * The active Admission for a just-admitted student, and its most recent
   * Enrollment — enough for a "View Admission"/"View Enrollment" deep link
   * from an `APPLICANT_ALREADY_ADMITTED` conflict. `client` is either the
   * in-flight transaction (the common, lock-serialized path) or `this.prisma`
   * (the P2002 race path in `translate`, which runs after that transaction
   * has already rolled back).
   */
  private async findActiveAdmissionAndEnrollment(
    client: PrismaTransactionClient | PrismaService,
    studentId: string,
  ): Promise<{ admissionId: string | null; enrollmentId: string | null }> {
    const admission = await client.admission.findFirst({
      where: { studentId, status: 'ACTIVE' },
      select: {
        id: true,
        enrollments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });

    return {
      admissionId: admission?.id ?? null,
      enrollmentId: admission?.enrollments[0]?.id ?? null,
    };
  }

  /**
   * A Student already exists for this human.
   *
   * That is the readmission path, and readmission is not this operation: it
   * closes a previous spell of study, needs an elevated permission for an
   * expelled student, and records a mandatory reason. Creating a second Student
   * instead would split one person's record permanently, so this refuses and
   * names what exists.
   */
  private async assertNoExistingStudent(
    tx: PrismaTransactionClient,
    organizationId: string,
    personId: string,
  ): Promise<void> {
    const existing = await tx.student.findFirst({
      where: { organizationId, personId },
      select: { id: true, studentCode: true, status: true },
    });

    if (existing) {
      throw new ConflictException({
        error: 'STUDENT_ALREADY_EXISTS',
        message:
          'This person is already a student at this organization. Returning students are readmitted against the existing identity, which is a separate operation.',
        studentId: existing.id,
        studentCode: existing.studentCode,
        studentStatus: existing.status,
      });
    }
  }

  /**
   * Translate what the database refused.
   *
   * The uniqueness rules are the final authority — the applicant lock serialises
   * the normal case, and these catch everything it cannot see, such as two
   * different applicants for one person admitted at two branches at once.
   */
  private async translate(
    error: unknown,
    applicantId: string,
  ): Promise<unknown> {
    // `assertNumberingProvisioned` already checked this before the transaction
    // opened (400 BadRequestException). This is that same condition losing a
    // TOCTOU race — the config was deactivated or deleted between the
    // pre-flight check and `numbering.allocate()` running inside the
    // transaction, where `NumberingService.requireConfig` throws
    // `InternalServerErrorException` (500) instead, by design — see
    // `numbering.service.ts`, a frozen, independently-audited module this
    // does not modify. Remapped here so a caller of `admit()` sees one status
    // code for one condition regardless of timing, without changing
    // `NumberingService`'s contract for any of its other callers.
    if (
      error instanceof InternalServerErrorException &&
      (error.getResponse() as { error?: string })?.error ===
        'NUMBERING_NOT_PROVISIONED'
    ) {
      return new BadRequestException(error.getResponse());
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const meta = (error.meta ?? {}) as { target?: string | string[] };
      const target = Array.isArray(meta.target)
        ? meta.target.join(',')
        : String(meta.target ?? '');

      if (error.code === 'P2002') {
        if (target.includes('sourceApplicantId')) {
          // The transaction that won this race has already committed, so the
          // student/admission/enrollment it created are readable outside it.
          const student = await this.prisma.student.findFirst({
            where: { sourceApplicantId: applicantId },
            select: { id: true, studentCode: true },
          });
          const { admissionId, enrollmentId } = student
            ? await this.findActiveAdmissionAndEnrollment(
                this.prisma,
                student.id,
              )
            : { admissionId: null, enrollmentId: null };

          return new ConflictException({
            error: 'APPLICANT_ALREADY_ADMITTED',
            message:
              'This application has already been converted to a student.',
            applicantId,
            studentId: student?.id ?? null,
            studentCode: student?.studentCode ?? null,
            admissionId,
            enrollmentId,
          });
        }
        if (target.includes('personId')) {
          return new ConflictException({
            error: 'STUDENT_ALREADY_EXISTS',
            message: 'This person is already a student at this organization.',
          });
        }
      }
    }

    return error;
  }
}

interface ResolvedPlacement {
  programId: string;
  academicUnitId: string;
}

interface LoadedApplicant {
  submittedAt: Date | null;
  id: string;
  organizationId: string;
  branchId: string;
  academicYearId: string;
  admissionStatus: AdmissionApplicationStatus;
  programId: string | null;
  personId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dob: Date;
  genderId: string;
  religionId: string | null;
  casteId: string | null;
  categoryId: string | null;
  motherTongueId: string | null;
  bloodGroupId: string | null;
  disabilityStatus: boolean;
  disabilityTypeId: string | null;
  primaryMobile: string | null;
  primaryEmail: string | null;
  apaarId: string | null;
  penNo: string | null;
  aadhaarNo: string | null;
  quotaId: string | null;
  admissionSourceId: string | null;
}
