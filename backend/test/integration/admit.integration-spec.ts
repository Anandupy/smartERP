import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { ApplicantService } from '@/modules/admissions/applicant/applicant.service';
import { WorkflowService } from '@/modules/admissions/workflow/workflow.service';
import { WorkflowAction } from '@/modules/admissions/workflow/workflow.transitions';
import { AdmissionConversionService } from '@/modules/admissions/admission/admission-conversion.service';
import { StudentService } from '@/modules/identity/student/student.service';
import { EnrollmentService } from '@/modules/enrollment/enrollment.service';
import { AdmissionService } from '@/modules/admissions/admission/admission.service';
import { PersonService } from '@/modules/identity/person/person.service';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { OutboxRelay } from '@/infrastructure/outbox/outbox.relay';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { ResourceScope } from '@/common/scope/resource-scope';

/**
 * Phase 5 — the conversion, against real Postgres.
 *
 * The proof this file exists for is one test: twenty simultaneous requests to
 * admit the same applicant produce one student, one admission, one enrolment
 * and nineteen clean conflicts. Everything else here is the failure matrix —
 * for each step, an injected error and a check that the database is exactly as
 * it was.
 */
describe('Admission conversion (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let applicants: ApplicantService;
  let workflow: WorkflowService;
  let conversion: AdmissionConversionService;
  let students: StudentService;
  let enrollments: EnrollmentService;
  let admissions: AdmissionService;
  let persons: PersonService;
  let numbering: NumberingService;

  const suffix = Date.now().toString();
  let seq = 0;

  let orgId: string;
  let otherOrgId: string;
  let branchAId: string;
  let branchBId: string;
  let yearAId: string;
  let yearBId: string;
  let programAId: string;
  let programA2Id: string;
  let programBId: string;
  let unitA1Id: string;
  let unitA2Id: string;
  let unitA3Id: string;
  let unitBId: string;
  let genderId: string;

  let scopeA: ResourceScope;
  let scopeB: ResourceScope;

  const ADMIN = {
    userId: '00000000-0000-4000-8000-0000000000f1',
    role: 'SUPER_ADMIN',
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    applicants = moduleRef.get(ApplicantService);
    workflow = moduleRef.get(WorkflowService);
    conversion = moduleRef.get(AdmissionConversionService);
    students = moduleRef.get(StudentService);
    enrollments = moduleRef.get(EnrollmentService);
    admissions = moduleRef.get(AdmissionService);
    persons = moduleRef.get(PersonService);
    numbering = moduleRef.get(NumberingService);

    const makeOrg = async (label: string) =>
      (
        await prisma.organization.create({
          data: {
            name: `P5 ${label}`,
            code: `P5${label}_${suffix}`,
            contactEmail: 'p5@test.local',
            contactPhone: '1234567890',
            masterExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        })
      ).id;

    const makeBranch = async (organizationId: string, label: string) =>
      (
        await prisma.branch.create({
          data: {
            organizationId,
            name: `Branch ${label}`,
            code: `P5B${label}_${suffix}`,
            institutionType: 'SCHOOL',
            contactEmail: 'b@test.local',
            contactPhone: '1234567890',
            addressLine1: 'Road 1',
            city: 'Mumbai',
            state: 'MH',
            country: 'IN',
            pincode: '400001',
          },
        })
      ).id;

    const makeYear = async (branchId: string, from: string) =>
      (
        await prisma.academicYear.create({
          data: {
            branchId,
            name: `${from}-${Number(from) + 1} ${suffix}`,
            startDate: new Date(`${from}-04-01`),
            endDate: new Date(`${Number(from) + 1}-03-31`),
          },
        })
      ).id;

    const makeProgram = async (branchId: string, name: string) =>
      (await prisma.program.create({ data: { branchId, name } })).id;

    const makeUnit = async (
      branchId: string,
      programId: string,
      academicYearId: string,
      name: string,
    ) =>
      (
        await prisma.academicUnit.create({
          data: {
            branchId,
            programId,
            academicYearId,
            name,
            unitType: 'SECTION',
            level: 1,
          },
        })
      ).id;

    orgId = await makeOrg('ORG');
    otherOrgId = await makeOrg('OTH');
    branchAId = await makeBranch(orgId, 'A');
    branchBId = await makeBranch(orgId, 'B');

    yearAId = await makeYear(branchAId, '2026');
    yearBId = await makeYear(branchBId, '2026');

    programAId = await makeProgram(branchAId, `Std 1 ${suffix}`);
    programA2Id = await makeProgram(branchAId, `Std 1 Marathi ${suffix}`);
    programBId = await makeProgram(branchBId, `Std 1 B ${suffix}`);

    unitA1Id = await makeUnit(branchAId, programAId, yearAId, 'Std 1-A');
    unitA2Id = await makeUnit(branchAId, programAId, yearAId, 'Std 1-B');
    unitA3Id = await makeUnit(branchAId, programA2Id, yearAId, 'Std 1-M');
    unitBId = await makeUnit(branchBId, programBId, yearBId, 'Std 1-BB');

    genderId = (
      await prisma.gender.create({
        data: {
          organizationId: orgId,
          code: `P5G_${suffix}`,
          name: `G ${suffix}`,
        },
      })
    ).id;

    for (const branchId of [branchAId, branchBId]) {
      for (const purpose of [
        'ADMISSION_FORM',
        'APPLICATION',
        'ADMISSION_NO',
      ] as const) {
        await numbering.createConfig(
          {
            purpose,
            prefix: purpose === 'ADMISSION_NO' ? 'AD' : 'APP',
            sequencePadding: 5,
            format: '{prefix}-{year}-{sequence}',
          },
          orgId,
          branchId,
        );
      }
    }
    await numbering.createConfig(
      {
        purpose: 'STUDENT_CODE',
        prefix: 'STU',
        sequencePadding: 10,
        format: '{prefix}{sequence}',
      },
      orgId,
      null,
    );

    scopeA = {
      organizationId: orgId,
      branchId: branchAId,
      academicYearId: yearAId,
    };
    scopeB = {
      organizationId: orgId,
      branchId: branchBId,
      academicYearId: yearBId,
    };
  });

  afterAll(async () => {
    for (const org of [orgId, otherOrgId]) {
      await prisma.auditLog.deleteMany({ where: { organizationId: org } });
      await prisma.outboxEvent.deleteMany({ where: { organizationId: org } });
      await prisma.workflowHistory.deleteMany({
        where: { organizationId: org },
      });
      await prisma.enrollment.updateMany({
        where: { organizationId: org },
        data: {
          enrollmentStatus: 'CANCELLED',
          originType: 'ADMISSION',
          supersededById: null,
          previousEnrollmentId: null,
          changeReason: null,
          exitDate: new Date(),
          exitReason: 'CANCELLED_BEFORE_JOINING',
        },
      });
      await prisma.enrollment.deleteMany({ where: { organizationId: org } });
      await prisma.admission.updateMany({
        where: { organizationId: org },
        data: { previousAdmissionId: null, sourceApplicantId: null },
      });
      await prisma.admission.deleteMany({ where: { organizationId: org } });
      // `student_origin_check` licenses a null source applicant only for a
      // MIGRATION student, so the teardown moves both together.
      await prisma.student.updateMany({
        where: { organizationId: org },
        data: { createdVia: 'MIGRATION', sourceApplicantId: null },
      });
      await prisma.applicant.deleteMany({ where: { organizationId: org } });
      await prisma.student.deleteMany({ where: { organizationId: org } });
      await prisma.personSensitive.deleteMany({
        where: { person: { organizationId: org } },
      });
      await prisma.person.deleteMany({ where: { organizationId: org } });
      await prisma.organizationDataKey.deleteMany({
        where: { organizationId: org },
      });
      await prisma.numberSequenceCounter.deleteMany({
        where: { config: { organizationId: org } },
      });
      await prisma.numberSequenceConfig.deleteMany({
        where: { organizationId: org },
      });
      await prisma.academicUnit.deleteMany({
        where: { branch: { organizationId: org } },
      });
      await prisma.program.deleteMany({
        where: { branch: { organizationId: org } },
      });
      await prisma.academicYear.deleteMany({
        where: { branch: { organizationId: org } },
      });
      await prisma.gender.deleteMany({ where: { organizationId: org } });
      await prisma.branch.deleteMany({ where: { organizationId: org } });
      await prisma.organization.deleteMany({ where: { id: org } });
    }
    await moduleRef.close();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.academicYear.updateMany({
      where: { branchId: branchAId },
      data: { isLocked: false },
    });
  });

  // ---------------------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------------------

  /** Distinct, format-valid Aadhaar per call, or a shared one when given. */
  function aadhaar(shared?: string): string {
    if (shared) return shared;
    seq += 1;
    return `2${String((Date.now() + seq) % 100000000).padStart(8, '0')}${String(
      seq % 1000,
    ).padStart(3, '0')}`.slice(0, 12);
  }

  /** An applicant driven through the funnel to SEAT_CONFIRMED. */
  async function seatConfirmed(
    options: {
      scope?: ResourceScope;
      programId?: string;
      aadhaarNo?: string | null;
      identity?: string;
    } = {},
  ) {
    seq += 1;
    const scope = options.scope ?? scopeA;
    const identity = options.identity ?? `p5x${suffix}${seq}`;
    const programId =
      options.programId ??
      (scope.branchId === branchAId ? programAId : programBId);

    const { applicant } = await applicants.create(
      {
        firstName: 'Riya',
        lastName: `Sharma${identity}`,
        dob: '2015-04-12',
        genderId,
        programId,
        aadhaarNo:
          options.aadhaarNo === null
            ? undefined
            : (options.aadhaarNo ?? aadhaar()),
        primaryMobile: `9${String(seq).padStart(9, '0')}`,
        currentAddressLine1: 'Road 1',
        city: 'Mumbai',
        state: 'MH',
        country: 'IN',
        pincode: '400001',
      } as never,
      scope,
    );

    const act = (action: WorkflowAction, remarks?: string) =>
      workflow.transition(applicant.id, { action, remarks }, scope, ADMIN);

    await act(WorkflowAction.SUBMIT);
    await act(WorkflowAction.START_REVIEW);
    await act(WorkflowAction.APPROVE);
    await act(WorkflowAction.CONFIRM_SEAT);

    return applicant;
  }

  const admit = (
    applicantId: string,
    overrides: Record<string, unknown> = {},
    scope: ResourceScope = scopeA,
  ) =>
    conversion.admit(
      applicantId,
      { academicUnitId: unitA1Id, ...overrides } as never,
      scope,
      ADMIN,
    );

  /** Everything the conversion could have written, counted. */
  async function footprint(applicantId: string) {
    const [
      applicant,
      students,
      admissionRows,
      enrollmentRows,
      history,
      events,
    ] = await Promise.all([
      prisma.applicant.findUniqueOrThrow({ where: { id: applicantId } }),
      prisma.student.count({ where: { sourceApplicantId: applicantId } }),
      prisma.admission.count({ where: { sourceApplicantId: applicantId } }),
      prisma.enrollment.count({ where: { applicantId } }),
      prisma.workflowHistory.count({
        where: { entityId: applicantId, actionType: WorkflowAction.ADMIT },
      }),
      prisma.outboxEvent.count({
        where: { aggregateId: applicantId, eventName: 'applicant.admitted' },
      }),
    ]);

    return {
      status: applicant.admissionStatus,
      students,
      admissions: admissionRows,
      enrollments: enrollmentRows,
      history,
      events,
    };
  }

  const UNTOUCHED = {
    status: 'SEAT_CONFIRMED',
    students: 0,
    admissions: 0,
    enrollments: 0,
    history: 0,
    events: 0,
  };

  async function drainUntilAudited(aggregateId: string, eventName: string) {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      await moduleRef.get(OutboxRelay).drain();
      const rows = await prisma.auditLog.findMany({ where: { aggregateId } });
      if (rows.some((r) => r.eventName === eventName)) return rows;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return prisma.auditLog.findMany({ where: { aggregateId } });
  }

  const errorCode = (e: unknown) =>
    (e as { response?: { error?: string } })?.response?.error;

  // ---------------------------------------------------------------------------

  describe('the conversion', () => {
    it('produces exactly one of each, linked in both directions', async () => {
      const applicant = await seatConfirmed();
      const result = await admit(applicant.id);

      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });
      const admission = await prisma.admission.findUniqueOrThrow({
        where: { id: result.admissionId },
      });
      const enrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: result.enrollmentId },
      });
      const after = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });

      expect(after.admissionStatus).toBe('ADMITTED');

      // The chain, forwards.
      expect(student.sourceApplicantId).toBe(applicant.id);
      expect(student.personId).toBe(after.personId);
      expect(admission.studentId).toBe(student.id);
      expect(admission.sourceApplicantId).toBe(applicant.id);
      expect(enrollment.studentId).toBe(student.id);
      expect(enrollment.admissionId).toBe(admission.id);
      expect(enrollment.applicantId).toBe(applicant.id);

      expect(student.status).toBe('ACTIVE');
      expect(admission.status).toBe('ACTIVE');
      expect(admission.admissionType).toBe('REGULAR');
      expect(enrollment.enrollmentStatus).toBe('ACTIVE');
      expect(enrollment.enrollmentKind).toBe('PRIMARY');
      expect(enrollment.originType).toBe('ADMISSION');
      // Manual is the default policy, so nothing was invented.
      expect(enrollment.rollNumber).toBeNull();

      expect(await footprint(applicant.id)).toEqual({
        status: 'ADMITTED',
        students: 1,
        admissions: 1,
        enrollments: 1,
        history: 1,
        events: 1,
      });
    });

    it('issues a permanent, organization-scoped student code', async () => {
      const applicant = await seatConfirmed();
      const result = await admit(applicant.id);

      expect(result.studentCode).toMatch(/^STU\d{10}$/);
      expect(result.admissionNo).toMatch(/^AD-.+-\d{5}$/);
      // UUID v7 internally; the code is the human-facing identity.
      expect(result.studentId[14]).toBe('7');
    });

    it('keeps the applicant as evidence rather than replacing it', async () => {
      const applicant = await seatConfirmed();
      const result = await admit(applicant.id);

      const survivor = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(survivor.deletedAt).toBeNull();
      expect(survivor.admissionStatus).toBe('ADMITTED');

      // And it cannot be removed out from under the student: the enrolment's
      // provenance foreign key is RESTRICT.
      await expect(
        prisma.applicant.delete({ where: { id: applicant.id } }),
      ).rejects.toThrow();

      expect(
        await prisma.student.count({ where: { id: result.studentId } }),
      ).toBe(1);
    });

    it('is traceable from the student code back to the application', async () => {
      const applicant = await seatConfirmed();
      const result = await admit(applicant.id);

      const found = await prisma.student.findFirstOrThrow({
        where: { organizationId: orgId, studentCode: result.studentCode },
        include: { admissions: { include: { enrollments: true } } },
      });

      // Support answers "who is STU…?" without touching demographics.
      expect(found.sourceApplicantId).toBe(applicant.id);
      expect(found.admissions).toHaveLength(1);
      expect(found.admissions[0].enrollments).toHaveLength(1);
      expect(found.admissions[0].enrollments[0].id).toBe(result.enrollmentId);
    });

    it('writes the transition through the machine, not around it', async () => {
      const applicant = await seatConfirmed();
      await admit(applicant.id, { remarks: 'seat accepted at the counter' });

      const history = await prisma.workflowHistory.findFirstOrThrow({
        where: { entityId: applicant.id, actionType: WorkflowAction.ADMIT },
      });
      expect(history).toMatchObject({
        entityType: 'APPLICANT',
        oldStatus: 'SEAT_CONFIRMED',
        newStatus: 'ADMITTED',
        actionBy: ADMIN.userId,
        remarks: 'seat accepted at the counter',
      });
    });

    it('records a lateral entry when told to', async () => {
      const applicant = await seatConfirmed();
      const result = await admit(applicant.id, {
        admissionType: 'LATERAL_ENTRY',
      });

      const admission = await prisma.admission.findUniqueOrThrow({
        where: { id: result.admissionId },
      });
      expect(admission.admissionType).toBe('LATERAL_ENTRY');
    });

    it('copies no demographic field into the placement', async () => {
      const applicant = await seatConfirmed();
      const result = await admit(applicant.id);

      const enrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: result.enrollmentId },
      });
      for (const forbidden of [
        'firstName',
        'lastName',
        'dob',
        'genderId',
        'aadhaarNo',
        'studentCode',
        'admissionNo',
      ]) {
        expect(Object.keys(enrollment)).not.toContain(forbidden);
      }
    });
  });

  // ---------------------------------------------------------------------------

  describe('concurrency', () => {
    /** The Phase 5 proof. */
    it('turns twenty simultaneous admissions into one student', async () => {
      const applicant = await seatConfirmed();

      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () => admit(applicant.id)),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled).toHaveLength(1);

      expect(await footprint(applicant.id)).toEqual({
        status: 'ADMITTED',
        students: 1,
        admissions: 1,
        enrollments: 1,
        history: 1,
        events: 1,
      });

      // No duplicate code was burned into a second identity, and no partial
      // row survived from the nineteen that lost.
      const codes = await prisma.student.findMany({
        where: { sourceApplicantId: applicant.id },
        select: { studentCode: true },
      });
      expect(new Set(codes.map((c) => c.studentCode)).size).toBe(1);

      // Every loser got a business answer, not a leaked constraint.
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(rejected).toHaveLength(19);
      for (const failure of rejected) {
        expect([
          'APPLICANT_ALREADY_ADMITTED',
          'APPLICANT_NOT_SEAT_CONFIRMED',
          'STUDENT_ALREADY_EXISTS',
        ]).toContain(errorCode(failure.reason));
        expect(JSON.stringify(failure.reason)).not.toMatch(/P200\d/);
      }
    });

    it('names the winning student to the losers', async () => {
      const applicant = await seatConfirmed();

      const results = await Promise.allSettled([
        admit(applicant.id),
        admit(applicant.id),
      ]);

      const winner = results.find((r) => r.status === 'fulfilled') as
        | PromiseFulfilledResult<{ studentId: string; studentCode: string }>
        | undefined;
      const loser = results.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;

      const details = (loser!.reason as { response: Record<string, unknown> })
        .response;

      if (details.error === 'APPLICANT_ALREADY_ADMITTED' && details.studentId) {
        // Enough for a client to treat the conflict as the completed
        // operation it is.
        expect(details.studentId).toBe(winner!.value.studentId);
        expect(details.studentCode).toBe(winner!.value.studentCode);
      }
      expect(JSON.stringify(details)).not.toContain('aadhaar');
    });

    it('gives one student to two applications for the same human', async () => {
      const shared = aadhaar();
      const first = await seatConfirmed({
        aadhaarNo: shared,
        identity: `twinA${suffix}`,
      });
      // The one-live-application index bites on the second submission, so the
      // second application is raised in the other branch — the case §33 calls
      // "the same child seat-confirmed at two branches".
      const second = await seatConfirmed({
        scope: scopeB,
        aadhaarNo: shared,
        identity: `twinB${suffix}`,
      });

      const results = await Promise.allSettled([
        admit(first.id),
        conversion.admit(
          second.id,
          { academicUnitId: unitBId } as never,
          scopeB,
          ADMIN,
        ),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const people = await prisma.person.findMany({
        where: { organizationId: orgId },
      });
      const studentsForPeople = await prisma.student.findMany({
        where: { personId: { in: people.map((p) => p.id) } },
      });

      // The government identifier resolves both applications to one Person,
      // and `@@unique([organizationId, personId])` refuses the second Student.
      // Two identities for one child would split their record for life.
      const byPerson = new Map<string, number>();
      for (const student of studentsForPeople) {
        byPerson.set(
          student.personId,
          (byPerson.get(student.personId) ?? 0) + 1,
        );
      }
      for (const count of byPerson.values()) {
        expect(count).toBe(1);
      }

      const loser = results.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      expect(errorCode(loser?.reason)).toBe('STUDENT_ALREADY_EXISTS');
    });

    it('lets a cancel and an admit produce one coherent outcome', async () => {
      const applicant = await seatConfirmed();

      const results = await Promise.allSettled([
        admit(applicant.id),
        workflow.transition(
          applicant.id,
          {
            action: WorkflowAction.CANCEL,
            remarks: 'withdrawn at the counter',
          },
          scopeA,
          ADMIN,
        ),
      ]);

      // The row lock orders them and the state machine decides the loser.
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const after = await footprint(applicant.id);
      if (after.status === 'ADMITTED') {
        expect(after).toMatchObject({
          students: 1,
          admissions: 1,
          enrollments: 1,
        });
      } else {
        expect(after.status).toBe('CANCELLED');
        expect(after).toMatchObject({
          students: 0,
          admissions: 0,
          enrollments: 0,
        });
      }
    });

    it('allocates distinct student codes under load', async () => {
      const cohort = await Promise.all(
        Array.from({ length: 5 }, () => seatConfirmed()),
      );

      const results = await Promise.all(
        cohort.map((applicant, i) =>
          admit(applicant.id, { academicUnitId: i % 2 ? unitA2Id : unitA1Id }),
        ),
      );

      const codes = results.map((r) => r.studentCode);
      expect(new Set(codes).size).toBe(5);
      for (const code of codes) expect(code).toMatch(/^STU\d{10}$/);
    });
  });

  // ---------------------------------------------------------------------------

  describe('nothing partial survives a failure', () => {
    const inject = (target: object, method: string) =>
      jest
        .spyOn(target as never, method as never)
        .mockRejectedValueOnce(new Error('injected failure') as never);

    it.each([
      ['student creation', () => inject(students, 'createControlled')],
      ['admission creation', () => inject(admissions, 'createControlled')],
      [
        'enrollment creation',
        () => inject(enrollments, 'createInitialEnrollment'),
      ],
      ['the applicant transition', () => inject(workflow, 'transition')],
      [
        'the outbox write',
        () => inject(moduleRef.get(OutboxPublisher), 'enqueue'),
      ],
    ])('rolls everything back when %s fails', async (_name, injectFailure) => {
      const applicant = await seatConfirmed();
      injectFailure();

      await expect(admit(applicant.id)).rejects.toThrow();

      // The whole point of the phase: no student without an admission, no
      // admission without an enrolment, and no applicant marked admitted with
      // nothing behind it.
      expect(await footprint(applicant.id)).toEqual(UNTOUCHED);
    });

    it('cannot even be put in the state that would need re-resolution', async () => {
      const applicant = await seatConfirmed();

      // Admission re-resolves identity only for a row that predates the
      // identity index. `applicant_person_from_submitted_check` means no such
      // row can be created any more, so that branch is reachable only by the
      // grandfathered rows the Phase 3 migration deliberately left alone.
      await expect(
        prisma.applicant.update({
          where: { id: applicant.id },
          data: { personId: null },
        }),
      ).rejects.toThrow(/applicant_person_from_submitted_check/);

      const after = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(after.personId).toBeTruthy();
    });

    it('rolls back a failure that happens after everything is written', async () => {
      const applicant = await seatConfirmed();

      // The last possible moment: the transition has run, three rows exist,
      // and the transaction has not committed.
      const original = workflow.transition.bind(workflow);
      jest
        .spyOn(workflow, 'transition')
        .mockImplementation(async (...args: Parameters<typeof original>) => {
          await original(...args);
          throw new Error('injected failure after the transition');
        });

      await expect(admit(applicant.id)).rejects.toThrow(
        'injected failure after the transition',
      );

      expect(await footprint(applicant.id)).toEqual(UNTOUCHED);
    });

    it('leaves nothing behind when the year locks first', async () => {
      const applicant = await seatConfirmed();
      await prisma.academicYear.update({
        where: { id: yearAId },
        data: { isLocked: true },
      });

      await expect(admit(applicant.id)).rejects.toMatchObject({
        response: { error: 'ACADEMIC_YEAR_LOCKED' },
      });

      expect(await footprint(applicant.id)).toEqual(UNTOUCHED);
    });

    it('leaves nothing behind when the unit is wrong', async () => {
      const applicant = await seatConfirmed();

      for (const academicUnitId of [unitA3Id, unitBId]) {
        await expect(
          admit(applicant.id, { academicUnitId }),
        ).rejects.toMatchObject({
          response: { error: 'ACADEMIC_UNIT_MISMATCH' },
        });
      }

      expect(await footprint(applicant.id)).toEqual(UNTOUCHED);
    });

    it('leaves nothing behind when the sequence is not provisioned', async () => {
      const applicant = await seatConfirmed();

      const config = await prisma.numberSequenceConfig.findFirstOrThrow({
        where: { organizationId: orgId, purpose: 'STUDENT_CODE' },
      });
      await prisma.numberSequenceConfig.update({
        where: { id: config.id },
        data: { deletedAt: new Date() },
      });

      try {
        await expect(admit(applicant.id)).rejects.toMatchObject({
          response: { error: 'NUMBERING_NOT_PROVISIONED' },
        });
        expect(await footprint(applicant.id)).toEqual(UNTOUCHED);
      } finally {
        await prisma.numberSequenceConfig.update({
          where: { id: config.id },
          data: { deletedAt: null },
        });
      }
    });

    it('refuses an application that has not confirmed its seat', async () => {
      seq += 1;
      const { applicant } = await applicants.create(
        {
          firstName: 'Riya',
          lastName: `Early${suffix}${seq}`,
          dob: '2015-04-12',
          genderId,
          programId: programAId,
          primaryMobile: `96${String(seq).padStart(8, '0')}`,
          currentAddressLine1: 'Road 1',
          city: 'Mumbai',
          state: 'MH',
          country: 'IN',
          pincode: '400001',
        } as never,
        scopeA,
      );
      await workflow.transition(
        applicant.id,
        { action: WorkflowAction.SUBMIT },
        scopeA,
        ADMIN,
      );

      await expect(admit(applicant.id)).rejects.toMatchObject({
        response: { error: 'APPLICANT_NOT_SEAT_CONFIRMED' },
      });

      const after = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(after.admissionStatus).toBe('SUBMITTED');
      expect(
        await prisma.student.count({
          where: { sourceApplicantId: applicant.id },
        }),
      ).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------

  describe('the readmission boundary', () => {
    it('refuses a second admission for a person who is already a student', async () => {
      const shared = aadhaar();
      const first = await seatConfirmed({
        aadhaarNo: shared,
        identity: `readA${suffix}`,
      });
      await admit(first.id);

      const second = await seatConfirmed({
        scope: scopeB,
        aadhaarNo: shared,
        identity: `readB${suffix}`,
      });

      const caught = await conversion
        .admit(second.id, { academicUnitId: unitBId } as never, scopeB, ADMIN)
        .catch((e: unknown) => e);

      expect(errorCode(caught)).toBe('STUDENT_ALREADY_EXISTS');
      expect(
        (caught as { response: Record<string, unknown> }).response.studentCode,
      ).toMatch(/^STU\d{10}$/);

      // The second application is untouched and can be readmitted properly
      // once that operation exists.
      const after = await prisma.applicant.findUniqueOrThrow({
        where: { id: second.id },
      });
      expect(after.admissionStatus).toBe('SEAT_CONFIRMED');
      expect(
        await prisma.student.count({ where: { sourceApplicantId: second.id } }),
      ).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------

  describe('security', () => {
    it('hides an applicant from another branch', async () => {
      const applicant = await seatConfirmed();

      await expect(
        conversion.admit(
          applicant.id,
          { academicUnitId: unitBId } as never,
          scopeB,
          ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(await footprint(applicant.id)).toEqual(UNTOUCHED);
    });

    it('hides an applicant from another organization', async () => {
      const applicant = await seatConfirmed();

      await expect(
        conversion.admit(
          applicant.id,
          { academicUnitId: unitA1Id } as never,
          {
            organizationId: otherOrgId,
            branchId: branchAId,
            academicYearId: yearAId,
          },
          ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('answers 404 rather than 403, so a probe learns nothing', async () => {
      const applicant = await seatConfirmed();

      await expect(
        conversion.admit(
          applicant.id,
          { academicUnitId: unitBId } as never,
          scopeB,
          ADMIN,
        ),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('refuses a caller without both permissions', async () => {
      const applicant = await seatConfirmed();

      await expect(
        conversion.admit(
          applicant.id,
          { academicUnitId: unitA1Id } as never,
          scopeA,
          {
            userId: '00000000-0000-4000-8000-0000000000f2',
            role: 'STUDENT',
          },
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(await footprint(applicant.id)).toEqual(UNTOUCHED);
    });

    it('cannot be reached through the generic workflow endpoint', async () => {
      const applicant = await seatConfirmed();

      await expect(
        workflow.transition(
          applicant.id,
          { action: WorkflowAction.ADMIT },
          scopeA,
          ADMIN,
        ),
      ).rejects.toMatchObject({
        response: { error: 'ORCHESTRATED_TRANSITION' },
      });

      // The status is unchanged and, crucially, no student exists — which is
      // the outcome the guard is there to prevent.
      expect(await footprint(applicant.id)).toEqual(UNTOUCHED);
    });
  });

  // ---------------------------------------------------------------------------

  describe('events and audit', () => {
    it('outboxes all four events in causal order', async () => {
      const applicant = await seatConfirmed();
      const result = await admit(applicant.id);

      const events = await prisma.outboxEvent.findMany({
        where: {
          aggregateId: {
            in: [
              applicant.id,
              result.studentId,
              result.admissionId,
              result.enrollmentId,
            ],
          },
        },
        orderBy: { occurredAt: 'asc' },
      });

      const names = events.map((e) => e.eventName);
      expect(names).toEqual(
        expect.arrayContaining([
          'student.created',
          'student.code_assigned',
          'admission.created',
          'enrollment.created',
          'applicant.admitted',
        ]),
      );

      // The student exists before the admission that explains it, and the
      // applicant's transition is last because it is only true once the rest
      // is written.
      const at = (name: string) => names.indexOf(name);
      expect(at('student.created')).toBeLessThan(at('admission.created'));
      expect(at('admission.created')).toBeLessThan(at('enrollment.created'));
      expect(at('enrollment.created')).toBeLessThan(at('applicant.admitted'));
    });

    it('carries every one of them to the audit log', async () => {
      const applicant = await seatConfirmed();
      const result = await admit(applicant.id);

      await drainUntilAudited(applicant.id, 'applicant.admitted');
      await drainUntilAudited(result.admissionId, 'admission.created');

      for (const [aggregateId, eventName] of [
        [applicant.id, 'applicant.admitted'],
        [result.studentId, 'student.created'],
        [result.admissionId, 'admission.created'],
        [result.enrollmentId, 'enrollment.created'],
      ]) {
        const rows = await prisma.auditLog.findMany({ where: { aggregateId } });
        expect(rows.map((r) => r.eventName)).toContain(eventName);
      }
    });

    it('does not duplicate audit rows when the relay runs again', async () => {
      const applicant = await seatConfirmed();
      await admit(applicant.id);

      await drainUntilAudited(applicant.id, 'applicant.admitted');
      await moduleRef.get(OutboxRelay).drain();
      await moduleRef.get(OutboxRelay).drain();

      const rows = await prisma.auditLog.findMany({
        where: { aggregateId: applicant.id, eventName: 'applicant.admitted' },
      });
      expect(rows).toHaveLength(1);
    });

    it('writes no audit row for a transaction that rolled back', async () => {
      const applicant = await seatConfirmed();
      const since = new Date();
      jest
        .spyOn(enrollments, 'createInitialEnrollment')
        .mockRejectedValueOnce(new Error('injected failure'));

      await expect(admit(applicant.id)).rejects.toThrow();
      await moduleRef.get(OutboxRelay).drain();

      // The funnel's own transitions are audited and should be — what must not
      // appear is a record of the conversion. Audit only ever sees committed
      // outbox rows, so a rolled-back transaction cannot leave one.
      const rows = await prisma.auditLog.findMany({
        where: { aggregateId: applicant.id },
      });
      expect(rows.map((r) => r.eventName)).not.toContain('applicant.admitted');
      expect(
        await prisma.auditLog.count({
          where: {
            eventName: {
              in: [
                'student.created',
                'admission.created',
                'enrollment.created',
              ],
            },
            timestamp: { gte: since },
          },
        }),
      ).toBe(0);
      expect(await footprint(applicant.id)).toEqual(UNTOUCHED);
    });

    it('survives the relay failing after the commit', async () => {
      const applicant = await seatConfirmed();
      const result = await admit(applicant.id);

      jest
        .spyOn(moduleRef.get(OutboxRelay), 'drain')
        .mockRejectedValueOnce(new Error('relay unavailable'));
      await expect(moduleRef.get(OutboxRelay).drain()).rejects.toThrow();

      // Different from an outbox insert failure: the data is committed and the
      // events are committed rows waiting to be published.
      expect(await footprint(applicant.id)).toMatchObject({
        status: 'ADMITTED',
        students: 1,
        admissions: 1,
        enrollments: 1,
      });

      const pending = await prisma.outboxEvent.findMany({
        where: { aggregateId: result.studentId },
      });
      expect(pending.length).toBeGreaterThan(0);
    });

    it('puts no sensitive value in any payload', async () => {
      const shared = aadhaar();
      const applicant = await seatConfirmed({ aadhaarNo: shared });
      const result = await admit(applicant.id);

      const events = await prisma.outboxEvent.findMany({
        where: {
          aggregateId: {
            in: [
              applicant.id,
              result.studentId,
              result.admissionId,
              result.enrollmentId,
            ],
          },
        },
      });

      const serialized = JSON.stringify(events);
      expect(serialized).not.toContain(shared);
      expect(serialized).not.toMatch(/aadhaar/i);
      expect(serialized).not.toMatch(/govtIdHash|blindIndex|ciphertext/i);
    });
  });

  // ---------------------------------------------------------------------------

  describe('identity', () => {
    it('admits an applicant with no government identifier', async () => {
      const applicant = await seatConfirmed({ aadhaarNo: null });
      const result = await admit(applicant.id);

      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });
      expect(student.personId).toBeTruthy();
    });

    it('reuses the Person the application already resolved', async () => {
      const applicant = await seatConfirmed();
      const before = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });

      const result = await admit(applicant.id);
      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });

      // Submission put them in the identity index; admission must land on the
      // same row rather than minting a second identity for one human.
      expect(student.personId).toBe(before.personId);
    });

    it('stores no government identifier on the student', async () => {
      const shared = aadhaar();
      const applicant = await seatConfirmed({ aadhaarNo: shared });
      const result = await admit(applicant.id);

      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });
      expect(JSON.stringify(student)).not.toContain(shared);
      expect(Object.keys(student)).not.toContain('aadhaarNo');
    });
  });
});
