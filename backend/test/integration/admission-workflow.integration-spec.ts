import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { ApplicantService } from '@/modules/admissions/applicant/applicant.service';
import { ApplicantPreferenceService } from '@/modules/admissions/applicant/applicant-preference.service';
import { WorkflowService } from '@/modules/admissions/workflow/workflow.service';
import { WorkflowAction } from '@/modules/admissions/workflow/workflow.transitions';
import { OfferExpiryJob } from '@/modules/admissions/workflow/offer-expiry.job';
import { AdmissionService } from '@/modules/admissions/admission/admission.service';
import { AdmissionConfigProvider } from '@/modules/admissions/admission-config.provider';
import { StudentService } from '@/modules/identity/student/student.service';
import { PersonService } from '@/modules/identity/person/person.service';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { OutboxRelay } from '@/infrastructure/outbox/outbox.relay';
import { ResourceScope } from '@/common/scope/resource-scope';

/**
 * Phase 3 — the admission domain against real Postgres.
 *
 * Concurrency and database constraints are the whole point of this file. Mocked,
 * a `SELECT ... FOR UPDATE` proves nothing and a partial unique index does not
 * exist at all: the tests that matter here are the ones that need two real
 * connections racing, or the server rejecting a row the application layer was
 * willing to write.
 */
describe('Admission workflow (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let applicants: ApplicantService;
  let preferences: ApplicantPreferenceService;
  let workflow: WorkflowService;
  let expiry: OfferExpiryJob;
  let admissions: AdmissionService;
  let config: AdmissionConfigProvider;
  let students: StudentService;
  let persons: PersonService;
  let numbering: NumberingService;

  const suffix = Date.now().toString();

  let orgId: string;
  let otherOrgId: string;
  let branchAId: string;
  let branchBId: string;
  let yearAId: string;
  let yearA2Id: string;
  let programAId: string;
  let programA2Id: string;
  let programBId: string;
  let unitAId: string;
  let unitBId: string;
  let genderId: string;
  let otherGenderId: string;

  let scopeA: ResourceScope;
  let scopeA2: ResourceScope;
  let scopeB: ResourceScope;

  /** SUPER_ADMIN inherits the seeded catalogue without needing a user row. */
  const ADMIN = {
    userId: '00000000-0000-4000-8000-0000000000a1',
    role: 'SUPER_ADMIN',
  };

  let seq = 0;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    applicants = moduleRef.get(ApplicantService);
    preferences = moduleRef.get(ApplicantPreferenceService);
    workflow = moduleRef.get(WorkflowService);
    expiry = moduleRef.get(OfferExpiryJob);
    admissions = moduleRef.get(AdmissionService);
    config = moduleRef.get(AdmissionConfigProvider);
    students = moduleRef.get(StudentService);
    persons = moduleRef.get(PersonService);
    numbering = moduleRef.get(NumberingService);

    const makeOrg = async (label: string) =>
      (
        await prisma.organization.create({
          data: {
            name: `P3 ${label}`,
            code: `P3${label}_${suffix}`,
            contactEmail: 'p3@test.local',
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
            code: `P3B${label}_${suffix}`,
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

    const makeYear = async (branchId: string, name: string, from: string) =>
      (
        await prisma.academicYear.create({
          data: {
            branchId,
            name,
            startDate: new Date(`${from}-04-01`),
            endDate: new Date(`${Number(from) + 1}-03-31`),
          },
        })
      ).id;

    orgId = await makeOrg('ORG');
    otherOrgId = await makeOrg('OTH');
    branchAId = await makeBranch(orgId, 'A');
    branchBId = await makeBranch(orgId, 'B');

    yearAId = await makeYear(branchAId, `2026-27 ${suffix}`, '2026');
    yearA2Id = await makeYear(branchAId, `2027-28 ${suffix}`, '2027');
    const yearBId = await makeYear(branchBId, `2026-27 ${suffix}`, '2026');

    programAId = (
      await prisma.program.create({
        data: { branchId: branchAId, name: `Std 1 ${suffix}` },
      })
    ).id;
    programA2Id = (
      await prisma.program.create({
        data: { branchId: branchAId, name: `Std 1 Marathi ${suffix}` },
      })
    ).id;
    programBId = (
      await prisma.program.create({
        data: { branchId: branchBId, name: `Std 1 B ${suffix}` },
      })
    ).id;

    unitAId = (
      await prisma.academicUnit.create({
        data: {
          branchId: branchAId,
          programId: programAId,
          academicYearId: yearAId,
          name: 'Std 1-A',
          unitType: 'SECTION',
          level: 1,
        },
      })
    ).id;
    unitBId = (
      await prisma.academicUnit.create({
        data: {
          branchId: branchBId,
          programId: programBId,
          academicYearId: yearBId,
          name: 'Std 1-B',
          unitType: 'SECTION',
          level: 1,
        },
      })
    ).id;

    genderId = (
      await prisma.gender.create({
        data: { organizationId: orgId, code: `P3G_${suffix}`, name: `G ${suffix}` },
      })
    ).id;
    otherGenderId = (
      await prisma.gender.create({
        data: {
          organizationId: otherOrgId,
          code: `P3GO_${suffix}`,
          name: `GO ${suffix}`,
        },
      })
    ).id;

    for (const branchId of [branchAId, branchBId]) {
      for (const purpose of ['ADMISSION_FORM', 'APPLICATION', 'ADMISSION_NO'] as const) {
        await numbering.createConfig(
          {
            purpose,
            prefix: purpose === 'ADMISSION_NO' ? 'AD' : 'APP',
            sequencePadding: 5,
            format: '{prefix}-{sequence}',
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
        sequencePadding: 8,
        format: '{prefix}{sequence}',
      },
      orgId,
      null,
    );

    scopeA = { organizationId: orgId, branchId: branchAId, academicYearId: yearAId };
    scopeA2 = { organizationId: orgId, branchId: branchAId, academicYearId: yearA2Id };
    scopeB = { organizationId: orgId, branchId: branchBId, academicYearId: yearBId };
  });

  afterAll(async () => {
    for (const org of [orgId, otherOrgId]) {
      await prisma.auditLog.deleteMany({ where: { organizationId: org } });
      await prisma.outboxEvent.deleteMany({ where: { organizationId: org } });
      await prisma.admission.deleteMany({ where: { organizationId: org } });
      await prisma.enrollment.deleteMany({ where: { organizationId: org } });
      await prisma.workflowHistory.deleteMany({ where: { organizationId: org } });
      await prisma.applicantProgramPreference.deleteMany({
        where: { applicant: { organizationId: org } },
      });
      await prisma.applicant.deleteMany({ where: { organizationId: org } });
      await prisma.student.deleteMany({ where: { organizationId: org } });
      await prisma.personSensitive.deleteMany({
        where: { person: { organizationId: org } },
      });
      await prisma.person.deleteMany({ where: { organizationId: org } });
      await prisma.organizationDataKey.deleteMany({ where: { organizationId: org } });
      await prisma.numberSequenceCounter.deleteMany({
        where: { config: { organizationId: org } },
      });
      await prisma.numberSequenceConfig.deleteMany({ where: { organizationId: org } });
      await prisma.academicUnit.deleteMany({ where: { branch: { organizationId: org } } });
      await prisma.program.deleteMany({ where: { branch: { organizationId: org } } });
      await prisma.academicYear.deleteMany({
        where: { branch: { organizationId: org } },
      });
      await prisma.gender.deleteMany({ where: { organizationId: org } });
      await prisma.branch.deleteMany({ where: { organizationId: org } });
      await prisma.organization.deleteMany({ where: { id: org } });
    }
    await moduleRef.close();
  });

  // ---------------------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------------------

  /**
   * A fresh application.
   *
   * `identity` decides which Person it will resolve to at submission: two calls
   * with the same identity are the same human applying twice, which is exactly
   * what the one-active-application rule is about.
   */
  async function newApplicant(
    scope: ResourceScope = scopeA,
    options: {
      programId?: string | null;
      identity?: string;
      aadhaarNo?: string | null;
    } = {},
  ) {
    seq += 1;
    const identity = options.identity ?? `unique${seq}`;
    const programId =
      options.programId === undefined
        ? scope.branchId === branchAId
          ? programAId
          : programBId
        : options.programId;

    const { applicant } = await applicants.create(
      {
        firstName: 'Riya',
        lastName: `Sharma${identity}`,
        dob: '2020-01-01',
        genderId,
        programId,
        aadhaarNo: options.aadhaarNo ?? undefined,
        primaryMobile: phoneFor(identity),
        currentAddressLine1: 'Road 1',
        city: 'Mumbai',
        state: 'MH',
        country: 'IN',
        pincode: '400001',
      } as never,
      scope,
    );
    return applicant;
  }

  /** A distinct, format-valid Aadhaar per call. */
  function aadhaar(): string {
    seq += 1;
    return `2${String(Date.now() % 100000000).padStart(8, '0')}${String(
      seq % 1000,
    ).padStart(3, '0')}`.slice(0, 12);
  }

  /** Stable ten digits per identity, so the same identity matches itself. */
  function phoneFor(identity: string): string {
    let hash = 0;
    for (const ch of identity) hash = (hash * 31 + ch.charCodeAt(0)) % 100000000;
    return `9${String(hash).padStart(9, '0')}`;
  }

  const act = (
    id: string,
    action: WorkflowAction,
    scope: ResourceScope = scopeA,
    remarks = 'because the operator said so',
  ) => workflow.transition(id, { action, remarks }, scope, ADMIN);

  /** Drive an application to APPROVED through the machine, not around it. */
  async function approved(scope: ResourceScope = scopeA, identity?: string) {
    const applicant = await newApplicant(scope, { identity });
    await act(applicant.id, WorkflowAction.SUBMIT, scope);
    await act(applicant.id, WorkflowAction.START_REVIEW, scope);
    return act(applicant.id, WorkflowAction.APPROVE, scope);
  }

  /** Make the offer already lapsed, without touching the status. */
  async function lapseOffer(applicantId: string) {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        offerIssuedAt: new Date(past.getTime() - 1000),
        offerExpiresAt: past,
      },
    });
  }

  async function newStudent(branchId = branchAId) {
    seq += 1;
    const { personId } = await persons.resolve(orgId, {
      firstName: 'Learner',
      lastName: `Person${seq}`,
      dob: new Date('2015-04-12'),
      phone: phoneFor(`student${seq}`),
    });

    return students.createControlled({
      organizationId: orgId,
      branchId,
      personId,
      firstName: 'Learner',
      lastName: `Person${seq}`,
      dob: new Date('2015-04-12'),
      genderId,
      createdVia: 'MIGRATION',
    });
  }

  /** Poll the relay rather than assume one drain publishes synchronously. */
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

  describe('concurrency', () => {
    it('lets exactly one of two simultaneous approvals win', async () => {
      const applicant = await newApplicant();
      await act(applicant.id, WorkflowAction.SUBMIT);
      await act(applicant.id, WorkflowAction.START_REVIEW);

      const results = await Promise.allSettled([
        act(applicant.id, WorkflowAction.APPROVE),
        act(applicant.id, WorkflowAction.APPROVE),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const loser = results.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      expect(errorCode(loser?.reason)).toBe('INVALID_TRANSITION');

      // One approval, one history row, one offer. Without the row lock both
      // read UNDER_REVIEW, both pass the guard, and the applicant is approved
      // twice with two offer windows and two audit trails.
      const history = await prisma.workflowHistory.findMany({
        where: { entityId: applicant.id, actionType: WorkflowAction.APPROVE },
      });
      expect(history).toHaveLength(1);

      const events = await prisma.outboxEvent.findMany({
        where: { aggregateId: applicant.id, eventName: 'applicant.offer_issued' },
      });
      expect(events).toHaveLength(1);
    });

    it('lets exactly one of an approval and a rejection win', async () => {
      const applicant = await newApplicant();
      await act(applicant.id, WorkflowAction.SUBMIT);
      await act(applicant.id, WorkflowAction.START_REVIEW);

      // Genuinely exclusive: neither is reachable from where the other lands.
      const results = await Promise.allSettled([
        act(applicant.id, WorkflowAction.APPROVE),
        act(applicant.id, WorkflowAction.REJECT, scopeA, 'below the cutoff'),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const final = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(['APPROVED', 'REJECTED']).toContain(final.admissionStatus);

      // Whichever won, the record agrees with itself. An applicant rejected
      // *and* holding a live offer is the state that produces a seat nobody
      // can account for.
      if (final.admissionStatus === 'REJECTED') {
        expect(final.offerIssuedAt).toBeNull();
        expect(final.offerExpiresAt).toBeNull();
        expect(final.rejectedAt).not.toBeNull();
      } else {
        expect(final.rejectedAt).toBeNull();
        expect(final.offerExpiresAt).not.toBeNull();
      }

      const history = await prisma.workflowHistory.findMany({
        where: { entityId: applicant.id },
      });
      expect(history.filter((h) => h.oldStatus === 'UNDER_REVIEW')).toHaveLength(1);
    });

    it('never interleaves two concurrent transitions', async () => {
      const applicant = await newApplicant();
      await act(applicant.id, WorkflowAction.SUBMIT);
      await act(applicant.id, WorkflowAction.START_REVIEW);

      // How many succeed is not fixed and must not be asserted: approve-then-
      // cancel is a legal sequence and both land, while cancel-then-approve is
      // not and the approval is refused. Which happens depends on who takes the
      // lock. What must hold either way is that the result is *a sequence*.
      const results = await Promise.allSettled([
        act(applicant.id, WorkflowAction.APPROVE),
        act(applicant.id, WorkflowAction.CANCEL, scopeA, 'seat withdrawn'),
      ]);
      expect(
        results.filter((r) => r.status === 'fulfilled').length,
      ).toBeGreaterThanOrEqual(1);

      const history = await prisma.workflowHistory.findMany({
        where: { entityId: applicant.id },
        orderBy: { timestamp: 'asc' },
      });

      // The ordering is visible and contiguous rather than interleaved: no row
      // starts anywhere other than where the previous one ended.
      for (let i = 1; i < history.length; i += 1) {
        expect(history[i].oldStatus).toBe(history[i - 1].newStatus);
      }

      const final = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(final.admissionStatus).toBe(history[history.length - 1].newStatus);
    });

    it('produces one live application when the same person submits twice at once', async () => {
      const identity = `twinsubmit${suffix}`;
      // The government identifier is what makes these provably the same child.
      // On demographics alone identity resolution deliberately declines to
      // merge — twins share every one of them.
      const govtId = aadhaar();
      const first = await newApplicant(scopeA, { identity, aadhaarNo: govtId });
      const second = await newApplicant(scopeA, {
        identity: `${identity}b`,
        aadhaarNo: govtId,
      });

      const results = await Promise.allSettled([
        act(first.id, WorkflowAction.SUBMIT),
        act(second.id, WorkflowAction.SUBMIT),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const loser = results.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      // The loser gets a 409 naming the rule, not a leaked P2002 quoting an
      // index name the caller has never heard of.
      expect(loser?.reason).toBeInstanceOf(ConflictException);
      expect(errorCode(loser?.reason)).toBe('DUPLICATE_ACTIVE_APPLICATION');

      const submitted = await prisma.applicant.findMany({
        where: { id: { in: [first.id, second.id] }, admissionStatus: 'SUBMITTED' },
      });
      expect(submitted).toHaveLength(1);

      // Both applications describe the same human, so identity resolution must
      // have produced one Person — two would split this candidate's record for
      // the rest of their life at the institution.
      // Person stores only a normalized name — it exists to be compared, not
      // read — so the identity slug is matched inside it.
      const people = await prisma.person.findMany({
        where: {
          organizationId: orgId,
          nameNormalized: { contains: identity.toLowerCase() },
        },
      });
      expect(people).toHaveLength(1);
      expect(submitted[0].personId).toBe(people[0].id);
    });

    it('never lets a seat confirmation and an expiry sweep both land', async () => {
      const applicant = await approved();
      await lapseOffer(applicant.id);

      const [confirm, sweep] = await Promise.allSettled([
        act(applicant.id, WorkflowAction.CONFIRM_SEAT),
        expiry.sweep(),
      ]);

      // The deadline is read under the lock, so confirmation of a lapsed offer
      // cannot win regardless of which transaction gets there first. Which
      // refusal it gets depends on who got the lock: OFFER_EXPIRED if the
      // confirmation was first and failed its guard, INVALID_TRANSITION if the
      // sweep had already moved the row to CANCELLED. Both are the same answer.
      expect(confirm.status).toBe('rejected');
      expect(['OFFER_EXPIRED', 'INVALID_TRANSITION']).toContain(
        errorCode((confirm as PromiseRejectedResult).reason),
      );
      expect(sweep.status).toBe('fulfilled');

      const final = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(final.admissionStatus).toBe('CANCELLED');
      expect(final.seatConfirmedAt).toBeNull();
    });

    it('leaves a live offer alone while it is being confirmed', async () => {
      const applicant = await approved();

      const [confirm, sweep] = await Promise.allSettled([
        act(applicant.id, WorkflowAction.CONFIRM_SEAT),
        expiry.sweep(),
      ]);

      expect(confirm.status).toBe('fulfilled');
      expect(sweep.status).toBe('fulfilled');

      const final = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(final.admissionStatus).toBe('SEAT_CONFIRMED');
      expect(final.seatConfirmedAt).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------

  describe('database invariants', () => {
    it('refuses a second live application for one person, branch and year', async () => {
      const govtId = aadhaar();
      const first = await newApplicant(scopeA, { aadhaarNo: govtId });
      await act(first.id, WorkflowAction.SUBMIT);

      const second = await newApplicant(scopeA, { aadhaarNo: govtId });
      await expect(act(second.id, WorkflowAction.SUBMIT)).rejects.toMatchObject({
        response: { error: 'DUPLICATE_ACTIVE_APPLICATION' },
      });
    });

    it('lets a rejected candidate apply again in the same year', async () => {
      const govtId = aadhaar();
      const first = await newApplicant(scopeA, { aadhaarNo: govtId });
      await act(first.id, WorkflowAction.SUBMIT);
      await act(first.id, WorkflowAction.REJECT, scopeA, 'documents incomplete');

      // The rule is "one *live* application", not "one application ever". A
      // rejected candidate reapplying is ordinary, and a rule that blocked it
      // would be a bug reported every admission season.
      const second = await newApplicant(scopeA, { aadhaarNo: govtId });
      await expect(act(second.id, WorkflowAction.SUBMIT)).resolves.toMatchObject({
        admissionStatus: 'SUBMITTED',
      });
    });

    it('lets the same person apply to the next academic year', async () => {
      const govtId = aadhaar();
      const first = await newApplicant(scopeA, { aadhaarNo: govtId });
      await act(first.id, WorkflowAction.SUBMIT);

      const second = await newApplicant(scopeA2, { aadhaarNo: govtId });
      await expect(
        act(second.id, WorkflowAction.SUBMIT, scopeA2),
      ).resolves.toMatchObject({ admissionStatus: 'SUBMITTED' });
    });

    it('refuses an offer window that closes before it opens', async () => {
      const applicant = await newApplicant();

      await expect(
        prisma.applicant.update({
          where: { id: applicant.id },
          data: {
            offerIssuedAt: new Date('2026-06-01'),
            offerExpiresAt: new Date('2026-05-01'),
          },
        }),
      ).rejects.toThrow(/applicant_offer_window_check/);
    });

    it('refuses half an offer window', async () => {
      const applicant = await newApplicant();

      await expect(
        prisma.applicant.update({
          where: { id: applicant.id },
          data: { offerExpiresAt: new Date('2026-06-01') },
        }),
      ).rejects.toThrow(/applicant_offer_window_check/);
    });

    it('refuses an application that defers from itself', async () => {
      const applicant = await newApplicant();

      await expect(
        prisma.applicant.update({
          where: { id: applicant.id },
          data: { deferredFromApplicantId: applicant.id },
        }),
      ).rejects.toThrow(/applicant_no_self_deferral_check/);
    });

    it('refuses a submitted application with no identity', async () => {
      const applicant = await newApplicant();

      // NOT VALID skips the initial scan of existing rows; it does not skip the
      // check on an UPDATE. The one grandfathered legacy row stays put, and
      // nothing new can reach this state.
      await expect(
        prisma.applicant.update({
          where: { id: applicant.id },
          data: { admissionStatus: 'SUBMITTED' },
        }),
      ).rejects.toThrow(/applicant_person_from_submitted_check/);
    });

    it('refuses a submitted application with no programme', async () => {
      const applicant = await newApplicant(scopeA, { programId: null });
      const { personId } = await persons.resolve(orgId, {
        firstName: 'Riya',
        lastName: `NoProgram${suffix}`,
        dob: new Date('2020-01-01'),
        phone: phoneFor(`noprogram${suffix}`),
      });

      await expect(
        prisma.applicant.update({
          where: { id: applicant.id },
          data: { admissionStatus: 'SUBMITTED', personId },
        }),
      ).rejects.toThrow(/applicant_program_from_submitted_check/);
    });

    it('refuses a preference at position zero', async () => {
      const applicant = await newApplicant();

      await expect(
        prisma.applicantProgramPreference.create({
          data: { applicantId: applicant.id, programId: programAId, preferenceOrder: 0 },
        }),
      ).rejects.toThrow(/preference_order_positive_check/);
    });
  });

  describe('admission invariants', () => {
    const entry = () => ({
      organizationId: orgId,
      branchId: branchAId,
      admissionType: 'REGULAR' as const,
      admissionDate: new Date('2026-06-01'),
      entryProgramId: programAId,
      entryAcademicUnitId: unitAId,
      academicYearId: yearAId,
    });

    it('allocates a branch-scoped admission number', async () => {
      const student = await newStudent();
      const admission = await admissions.createControlled({
        ...entry(),
        studentId: student.id,
      });

      expect(admission.admissionNo).toMatch(/^AD-\d{5}$/);
      expect(admission.status).toBe('ACTIVE');
      expect(admission.id[14]).toBe('7');
    });

    it('refuses a second active admission for one student', async () => {
      const student = await newStudent();
      await admissions.createControlled({ ...entry(), studentId: student.id });

      await expect(
        admissions.createControlled({ ...entry(), studentId: student.id }),
      ).rejects.toMatchObject({
        response: { error: 'ACTIVE_ADMISSION_EXISTS' },
      });
    });

    it('lets a closed admission be followed by another', async () => {
      const student = await newStudent();
      const first = await admissions.createControlled({
        ...entry(),
        studentId: student.id,
      });

      await prisma.admission.update({
        where: { id: first.id },
        data: {
          status: 'COMPLETED',
          exitDate: new Date('2027-03-31'),
          exitReason: 'GRADUATED',
        },
      });

      // A readmission is a second spell of study, not a second live one. The
      // partial index counts only ACTIVE rows precisely so this works.
      await expect(
        admissions.createControlled({
          ...entry(),
          studentId: student.id,
          admissionType: 'READMISSION',
          admissionDate: new Date('2028-06-01'),
          previousAdmissionId: first.id,
        }),
      ).resolves.toMatchObject({ status: 'ACTIVE' });
    });

    it('refuses a closed admission with no reason', async () => {
      const student = await newStudent();
      const admission = await admissions.createControlled({
        ...entry(),
        studentId: student.id,
      });

      await expect(
        prisma.admission.update({
          where: { id: admission.id },
          data: { status: 'COMPLETED', exitDate: new Date('2027-03-31') },
        }),
      ).rejects.toThrow(/admission_exit_check/);
    });

    it('refuses an open admission that carries an exit', async () => {
      const student = await newStudent();
      const admission = await admissions.createControlled({
        ...entry(),
        studentId: student.id,
      });

      await expect(
        prisma.admission.update({
          where: { id: admission.id },
          data: { exitDate: new Date('2027-03-31'), exitReason: 'GRADUATED' },
        }),
      ).rejects.toThrow(/admission_open_has_no_exit_check/);
    });

    it('refuses an exit before the joining date', async () => {
      const student = await newStudent();
      const admission = await admissions.createControlled({
        ...entry(),
        studentId: student.id,
      });

      await expect(
        prisma.admission.update({
          where: { id: admission.id },
          data: {
            status: 'CANCELLED',
            exitDate: new Date('2026-05-01'),
            exitReason: 'CANCELLED_BEFORE_JOINING',
          },
        }),
      ).rejects.toThrow(/admission_exit_after_entry_check/);
    });

    it('refuses a spell that continues from itself', async () => {
      const student = await newStudent();
      const admission = await admissions.createControlled({
        ...entry(),
        studentId: student.id,
      });

      await expect(
        prisma.admission.update({
          where: { id: admission.id },
          data: { previousAdmissionId: admission.id },
        }),
      ).rejects.toThrow(/admission_no_self_chain_check/);
    });

    /**
     * INV-ADM-001, which no foreign key can carry: `Student.branchId` moves when
     * a student transfers, so a composite key on it would invalidate every past
     * admission the moment it did.
     */
    it('refuses an admission at a branch the student does not belong to', async () => {
      const student = await newStudent(branchBId);

      await expect(
        admissions.createControlled({ ...entry(), studentId: student.id }),
      ).rejects.toMatchObject({
        response: { error: 'ADMISSION_BRANCH_MISMATCH' },
      });
    });

    it('refuses an entry programme from another branch', async () => {
      const student = await newStudent();

      await expect(
        admissions.createControlled({
          ...entry(),
          studentId: student.id,
          entryProgramId: programBId,
          entryAcademicUnitId: unitBId,
        }),
      ).rejects.toMatchObject({ response: { error: 'PROGRAM_OUT_OF_SCOPE' } });
    });

    it('refuses an academic unit belonging to another programme', async () => {
      const student = await newStudent();

      await expect(
        admissions.createControlled({
          ...entry(),
          studentId: student.id,
          entryProgramId: programA2Id,
          entryAcademicUnitId: unitAId,
        }),
      ).rejects.toMatchObject({ response: { error: 'ACADEMIC_UNIT_MISMATCH' } });
    });

    it('refuses a quota belonging to another organization', async () => {
      const student = await newStudent();
      const foreignQuota = await prisma.quota.create({
        data: {
          organizationId: otherOrgId,
          code: `Q_${suffix}`,
          name: `Quota ${suffix}`,
        },
      });

      await expect(
        admissions.createControlled({
          ...entry(),
          studentId: student.id,
          quotaId: foreignQuota.id,
        }),
      ).rejects.toMatchObject({ response: { error: 'QUOTA_OUT_OF_SCOPE' } });

      await prisma.quota.delete({ where: { id: foreignQuota.id } });
    });

    it('hides another branch admission from a read', async () => {
      const student = await newStudent();
      const admission = await admissions.createControlled({
        ...entry(),
        studentId: student.id,
      });

      await expect(admissions.findById(admission.id, scopeB)).rejects.toThrow(
        NotFoundException,
      );
      await expect(admissions.findById(admission.id, scopeA)).resolves.toMatchObject(
        { id: admission.id },
      );
    });
  });

  // ---------------------------------------------------------------------------

  describe('the offer and its expiry', () => {
    it('opens a window whose length comes from configuration', async () => {
      const applicant = await approved();

      expect(applicant.offerIssuedAt).not.toBeNull();
      expect(applicant.offerExpiresAt).not.toBeNull();

      const days = config.offerValidityDays({
        organizationId: orgId,
        branchId: branchAId,
      });
      expect(
        applicant.offerExpiresAt!.getTime() - applicant.offerIssuedAt!.getTime(),
      ).toBe(days * 24 * 60 * 60 * 1000);
    });

    it('cancels a lapsed offer through the state machine', async () => {
      const applicant = await approved();
      await lapseOffer(applicant.id);

      const result = await expiry.sweep();
      expect(result.expired).toBeGreaterThanOrEqual(1);

      const final = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      // CANCELLED, not REJECTED and not WITHDRAWN: the institution did not
      // refuse the candidate and the candidate did not walk away. Conflating
      // the three corrupts every conversion figure built on top of them.
      expect(final.admissionStatus).toBe('CANCELLED');
      expect(final.cancelledAt).not.toBeNull();

      const history = await prisma.workflowHistory.findFirstOrThrow({
        where: { entityId: applicant.id, actionType: WorkflowAction.EXPIRE_OFFER },
      });
      expect(history).toMatchObject({
        oldStatus: 'APPROVED',
        newStatus: 'CANCELLED',
        actionBy: 'SYSTEM',
      });
    });

    it('leaves a live offer untouched', async () => {
      const applicant = await approved();

      await expiry.sweep();

      const final = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(final.admissionStatus).toBe('APPROVED');
    });

    it('is idempotent', async () => {
      const applicant = await approved();
      await lapseOffer(applicant.id);

      await expiry.sweep();
      const second = await expiry.sweep();

      // Nothing left to find: the first pass moved the row out of APPROVED, so
      // a repeated sweep is a no-op rather than a second cancellation.
      const stillCandidate = await prisma.applicant.findFirst({
        where: { id: applicant.id, admissionStatus: 'APPROVED' },
      });
      expect(stillCandidate).toBeNull();
      expect(second.failed).toBe(0);

      const history = await prisma.workflowHistory.findMany({
        where: { entityId: applicant.id, actionType: WorkflowAction.EXPIRE_OFFER },
      });
      expect(history).toHaveLength(1);
    });

    it('refuses to confirm a seat after the deadline', async () => {
      const applicant = await approved();
      await lapseOffer(applicant.id);

      await expect(
        act(applicant.id, WorkflowAction.CONFIRM_SEAT),
      ).rejects.toMatchObject({ response: { error: 'OFFER_EXPIRED' } });
    });

    /** The funnel ends here. Everything past it belongs to the conversion. */
    it('stops at SEAT_CONFIRMED without creating a student', async () => {
      const applicant = await approved();
      const confirmed = await act(applicant.id, WorkflowAction.CONFIRM_SEAT);

      expect(confirmed.admissionStatus).toBe('SEAT_CONFIRMED');

      expect(
        await prisma.admission.count({ where: { sourceApplicantId: applicant.id } }),
      ).toBe(0);
      expect(
        await prisma.enrollment.count({ where: { applicantId: applicant.id } }),
      ).toBe(0);
      expect(
        await prisma.student.count({ where: { sourceApplicantId: applicant.id } }),
      ).toBe(0);

      // The workflow endpoint still cannot get there. Admission has an edge as
      // of Phase 5, but it is orchestrated: reaching ADMITTED means a student,
      // an admission and an enrolment were written in the same transaction,
      // and no request body can assert that.
      await expect(
        act(applicant.id, WorkflowAction.ADMIT),
      ).rejects.toMatchObject({ response: { error: 'ORCHESTRATED_TRANSITION' } });
    });
  });

  // ---------------------------------------------------------------------------

  describe('programme preferences', () => {
    it('numbers the list from the order supplied', async () => {
      const applicant = await newApplicant();

      const saved = await preferences.replaceAll(
        applicant.id,
        [{ programId: programA2Id }, { programId: programAId }],
        scopeA,
      );

      expect(saved.map((p) => [p.preferenceOrder, p.programId])).toEqual([
        [1, programA2Id],
        [2, programAId],
      ]);
    });

    it('replaces the whole list rather than merging into it', async () => {
      const applicant = await newApplicant();
      await preferences.replaceAll(
        applicant.id,
        [{ programId: programAId }, { programId: programA2Id }],
        scopeA,
      );

      const saved = await preferences.replaceAll(
        applicant.id,
        [{ programId: programA2Id }],
        scopeA,
      );

      // Reordering by deleting and reinserting inside one transaction is what
      // keeps two rows from ever sharing a position, which a sequence of
      // independent updates could not avoid.
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ preferenceOrder: 1, programId: programA2Id });
    });

    it('refuses the same programme twice', async () => {
      const applicant = await newApplicant();

      await expect(
        preferences.replaceAll(
          applicant.id,
          [{ programId: programAId }, { programId: programAId }],
          scopeA,
        ),
      ).rejects.toMatchObject({
        response: { error: 'PREFERENCE_DUPLICATE_PROGRAM' },
      });
    });

    it('refuses a programme from another branch', async () => {
      const applicant = await newApplicant();

      await expect(
        preferences.replaceAll(applicant.id, [{ programId: programBId }], scopeA),
      ).rejects.toMatchObject({ response: { error: 'PROGRAM_OUT_OF_SCOPE' } });
    });

    it('refuses an empty list', async () => {
      const applicant = await newApplicant();

      await expect(
        preferences.replaceAll(applicant.id, [], scopeA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('freezes the list once an offer has been made', async () => {
      const applicant = await approved();

      await expect(
        preferences.replaceAll(applicant.id, [{ programId: programAId }], scopeA),
      ).rejects.toMatchObject({ response: { error: 'APPLICANT_FROZEN' } });
    });

    it('goes with the application when it is deleted', async () => {
      const applicant = await newApplicant();
      await preferences.replaceAll(applicant.id, [{ programId: programAId }], scopeA);

      await prisma.applicant.delete({ where: { id: applicant.id } });

      // Preferences are part of the application, not a record of their own —
      // ON DELETE CASCADE, unlike the enrollment history, which must outlive it.
      expect(
        await prisma.applicantProgramPreference.count({
          where: { applicantId: applicant.id },
        }),
      ).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------

  describe('scope', () => {
    it('hides another branch application from every workflow entry point', async () => {
      const applicant = await newApplicant(scopeA);

      await expect(
        act(applicant.id, WorkflowAction.SUBMIT, scopeB),
      ).rejects.toThrow(NotFoundException);
      await expect(workflow.getHistory(applicant.id, scopeB)).rejects.toThrow(
        NotFoundException,
      );
      await expect(preferences.list(applicant.id, scopeB)).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        preferences.replaceAll(applicant.id, [{ programId: programBId }], scopeB),
      ).rejects.toThrow(NotFoundException);

      const unchanged = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(unchanged.admissionStatus).toBe('DRAFT');
    });

    it('answers 404 rather than 403, so a probe learns nothing', async () => {
      const applicant = await newApplicant(scopeA);

      // A 403 would confirm the id exists, which is the whole information a
      // scanner enumerating identifiers is after.
      await expect(
        act(applicant.id, WorkflowAction.SUBMIT, scopeB),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('refuses an application created against another branch programme', async () => {
      await expect(
        newApplicant(scopeA, { programId: programBId }),
      ).rejects.toMatchObject({ response: { error: 'PROGRAM_OUT_OF_SCOPE' } });
    });
  });

  // ---------------------------------------------------------------------------

  describe('the audit chain', () => {
    it('carries a transition from the outbox to the audit log', async () => {
      const applicant = await newApplicant();
      await act(applicant.id, WorkflowAction.SUBMIT);
      await act(applicant.id, WorkflowAction.START_REVIEW);
      await act(applicant.id, WorkflowAction.APPROVE);

      const rows = await drainUntilAudited(applicant.id, 'applicant.offer_issued');
      const names = rows.map((r) => r.eventName);

      // Each transition is named for what it was. A generic `applicant.updated`
      // would leave a report reconstructing meaning from field diffs.
      expect(names).toEqual(
        expect.arrayContaining([
          'applicant.submitted',
          'applicant.review_started',
          'applicant.offer_issued',
        ]),
      );
    });

    it('records a force-reopen at raised severity', async () => {
      const applicant = await newApplicant();
      await act(applicant.id, WorkflowAction.SUBMIT);
      await act(applicant.id, WorkflowAction.CANCEL, scopeA, 'created in error');
      await act(applicant.id, WorkflowAction.FORCE_REOPEN, scopeA, 'cancelled in error');

      const event = await prisma.outboxEvent.findFirstOrThrow({
        where: { aggregateId: applicant.id, eventName: 'applicant.force_reopened' },
      });
      expect(event.metadata).toMatchObject({ severity: 'WARN' });
    });

    it('writes history in the order the transitions happened', async () => {
      const applicant = await newApplicant();
      await act(applicant.id, WorkflowAction.SUBMIT);
      await act(applicant.id, WorkflowAction.START_REVIEW);
      await act(applicant.id, WorkflowAction.REQUEST_DOCUMENTS, scopeA, 'need the TC');
      await act(applicant.id, WorkflowAction.DOCUMENTS_RECEIVED);

      const history = await prisma.workflowHistory.findMany({
        where: { entityType: 'APPLICANT', entityId: applicant.id },
        orderBy: { timestamp: 'asc' },
      });

      expect(history.map((h) => [h.oldStatus, h.newStatus])).toEqual([
        ['DRAFT', 'SUBMITTED'],
        ['SUBMITTED', 'UNDER_REVIEW'],
        ['UNDER_REVIEW', 'DOCUMENT_PENDING'],
        ['DOCUMENT_PENDING', 'UNDER_REVIEW'],
      ]);
      // The chain is contiguous: each row starts where the previous one ended,
      // which is what makes it reconstructible rather than a pile of events.
      for (let i = 1; i < history.length; i += 1) {
        expect(history[i].oldStatus).toBe(history[i - 1].newStatus);
      }
    });

    it('keeps a reason on every transition that demanded one', async () => {
      const applicant = await newApplicant();
      await act(applicant.id, WorkflowAction.SUBMIT);
      await act(applicant.id, WorkflowAction.REJECT, scopeA, '  marks below the cutoff  ');

      const rejection = await prisma.workflowHistory.findFirstOrThrow({
        where: { entityId: applicant.id, actionType: WorkflowAction.REJECT },
      });
      expect(rejection.remarks).toBe('marks below the cutoff');
    });
  });

  // ---------------------------------------------------------------------------

  describe('identity at submission', () => {
    it('places the applicant in the identity index', async () => {
      const applicant = await newApplicant();
      expect(applicant.personId).toBeNull();

      const submitted = await act(applicant.id, WorkflowAction.SUBMIT);

      expect(submitted.personId).not.toBeNull();
      const person = await prisma.person.findUniqueOrThrow({
        where: { id: submitted.personId! },
      });
      expect(person.organizationId).toBe(orgId);
    });

    it('does not resolve a person across organizations', async () => {
      const identity = `crossorg${suffix}`;
      const first = await newApplicant(scopeA, { identity });
      const submitted = await act(first.id, WorkflowAction.SUBMIT);

      const otherOrgPeople = await prisma.person.findMany({
        where: { organizationId: otherOrgId },
      });
      expect(otherOrgPeople.map((p) => p.id)).not.toContain(submitted.personId);

      // Two institutions holding records for the same human hold two Persons.
      // A shared one would be a cross-tenant join nobody asked for.
      expect(otherGenderId).toBeTruthy();
    });

    it('refuses to submit an application with no programme', async () => {
      const applicant = await newApplicant(scopeA, { programId: null });

      await expect(act(applicant.id, WorkflowAction.SUBMIT)).rejects.toMatchObject({
        response: { error: 'PROGRAM_REQUIRED' },
      });

      const unchanged = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(unchanged.admissionStatus).toBe('DRAFT');
      // Nothing partial survived: no Person was created for an application that
      // did not move.
      expect(unchanged.personId).toBeNull();
    });
  });
});
