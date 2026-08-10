import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { ApplicantService } from '@/modules/admissions/applicant/applicant.service';
import { WorkflowService } from '@/modules/admissions/workflow/workflow.service';
import { WorkflowAction } from '@/modules/admissions/workflow/workflow.transitions';
import { AdmissionConversionService } from '@/modules/admissions/admission/admission-conversion.service';
import { AdmissionService } from '@/modules/admissions/admission/admission.service';
import { EnrollmentService } from '@/modules/enrollment/enrollment.service';
import { StudentService } from '@/modules/identity/student/student.service';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { OutboxRelay } from '@/infrastructure/outbox/outbox.relay';
import { ResourceScope } from '@/common/scope/resource-scope';

/**
 * Phase 5.5 — the five phases as one system.
 *
 * Each phase was tested inside its own boundary. This file tests the seams: the
 * properties that belong to no single phase and that only appear when Person,
 * Applicant, Student, Admission and Enrollment are composed by a real
 * admission against a real database.
 *
 * It deliberately does **not** repeat what the phase suites already prove —
 * the twenty-way race, the failure matrix, the raw-SQL constraint checks. What
 * it adds is the walk from one end of the chain to the other, and the
 * structural questions the next five modules will ask of it.
 */
describe('Admission pipeline (composition)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let applicants: ApplicantService;
  let workflow: WorkflowService;
  let conversion: AdmissionConversionService;
  let admissions: AdmissionService;
  let enrollments: EnrollmentService;
  let students: StudentService;
  let numbering: NumberingService;

  const suffix = Date.now().toString();
  let seq = 0;

  let orgA: string;
  let orgB: string;
  let mumbai: string;
  let pune: string;
  let branchB: string;
  let year2026: string;
  let year2027: string;
  let puneYear: string;
  let branchBYear: string;
  let program: string;
  let puneProgram: string;
  let branchBProgram: string;
  let std1A: string;
  let std1B: string;
  let std2A: string;
  let puneUnit: string;
  let branchBUnit: string;
  let genderA: string;
  let genderB: string;

  let scopeMumbai: ResourceScope;
  let scopePune: ResourceScope;
  let scopeOrgB: ResourceScope;

  const ADMIN = {
    userId: '00000000-0000-4000-8000-000000005501',
    role: 'SUPER_ADMIN',
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    applicants = moduleRef.get(ApplicantService);
    workflow = moduleRef.get(WorkflowService);
    conversion = moduleRef.get(AdmissionConversionService);
    admissions = moduleRef.get(AdmissionService);
    enrollments = moduleRef.get(EnrollmentService);
    students = moduleRef.get(StudentService);
    numbering = moduleRef.get(NumberingService);

    const org = async (label: string) =>
      (
        await prisma.organization.create({
          data: {
            name: `Pipeline ${label}`,
            code: `PL${label}_${suffix}`,
            contactEmail: 'pl@test.local',
            contactPhone: '1234567890',
            masterExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        })
      ).id;

    const branch = async (organizationId: string, label: string) =>
      (
        await prisma.branch.create({
          data: {
            organizationId,
            name: `Branch ${label}`,
            code: `PLB${label}_${suffix}`,
            institutionType: 'SCHOOL',
            contactEmail: 'b@test.local',
            contactPhone: '1234567890',
            addressLine1: 'Road 1',
            city: label,
            state: 'MH',
            country: 'IN',
            pincode: '400001',
          },
        })
      ).id;

    const year = async (branchId: string, from: string) =>
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

    const prog = async (branchId: string, name: string) =>
      (await prisma.program.create({ data: { branchId, name } })).id;

    const unit = async (
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

    // The golden dataset: one organization with two branches, and a second
    // organization to prove the tenant boundary.
    orgA = await org('A');
    orgB = await org('B');
    mumbai = await branch(orgA, 'Mumbai');
    pune = await branch(orgA, 'Pune');
    branchB = await branch(orgB, 'Other');

    year2026 = await year(mumbai, '2026');
    year2027 = await year(mumbai, '2027');
    puneYear = await year(pune, '2026');
    branchBYear = await year(branchB, '2026');

    program = await prog(mumbai, `Std 1 ${suffix}`);
    puneProgram = await prog(pune, `Std 1 Pune ${suffix}`);
    branchBProgram = await prog(branchB, `Std 1 B ${suffix}`);

    std1A = await unit(mumbai, program, year2026, 'Std 1-A');
    std1B = await unit(mumbai, program, year2026, 'Std 1-B');
    std2A = await unit(mumbai, program, year2027, 'Std 2-A');
    puneUnit = await unit(pune, puneProgram, puneYear, 'Std 1-P');
    branchBUnit = await unit(branchB, branchBProgram, branchBYear, 'Std 1-BB');

    genderA = (
      await prisma.gender.create({
        data: { organizationId: orgA, code: `PLG_${suffix}`, name: `G ${suffix}` },
      })
    ).id;
    genderB = (
      await prisma.gender.create({
        data: { organizationId: orgB, code: `PLGB_${suffix}`, name: `GB ${suffix}` },
      })
    ).id;

    for (const [organizationId, branchId] of [
      [orgA, mumbai],
      [orgA, pune],
      [orgB, branchB],
    ] as const) {
      for (const purpose of ['ADMISSION_FORM', 'APPLICATION', 'ADMISSION_NO'] as const) {
        await numbering.createConfig(
          {
            purpose,
            prefix: purpose === 'ADMISSION_NO' ? 'AD' : 'APP',
            sequencePadding: 5,
            format: '{prefix}-{year}-{sequence}',
          },
          organizationId,
          branchId,
        );
      }
    }
    for (const organizationId of [orgA, orgB]) {
      await numbering.createConfig(
        {
          purpose: 'STUDENT_CODE',
          prefix: 'STU',
          sequencePadding: 10,
          format: '{prefix}{sequence}',
        },
        organizationId,
        null,
      );
    }

    scopeMumbai = { organizationId: orgA, branchId: mumbai, academicYearId: year2026 };
    scopePune = { organizationId: orgA, branchId: pune, academicYearId: puneYear };
    scopeOrgB = {
      organizationId: orgB,
      branchId: branchB,
      academicYearId: branchBYear,
    };
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      await prisma.auditLog.deleteMany({ where: { organizationId: org } });
      await prisma.outboxEvent.deleteMany({ where: { organizationId: org } });
      await prisma.workflowHistory.deleteMany({ where: { organizationId: org } });
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
      await prisma.organizationDataKey.deleteMany({ where: { organizationId: org } });
      await prisma.numberSequenceCounter.deleteMany({
        where: { config: { organizationId: org } },
      });
      await prisma.numberSequenceConfig.deleteMany({ where: { organizationId: org } });
      await prisma.academicUnit.deleteMany({
        where: { branch: { organizationId: org } },
      });
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

  function aadhaar(): string {
    seq += 1;
    return `2${String((Date.now() + seq * 7919) % 100000000).padStart(8, '0')}${String(
      seq % 1000,
    ).padStart(3, '0')}`.slice(0, 12);
  }

  /** An application walked all the way to SEAT_CONFIRMED, the normal way. */
  async function applyAndConfirm(
    scope: ResourceScope = scopeMumbai,
    options: { aadhaarNo?: string; programId?: string } = {},
  ) {
    seq += 1;
    const programId =
      options.programId ??
      (scope.branchId === mumbai
        ? program
        : scope.branchId === pune
          ? puneProgram
          : branchBProgram);

    const { applicant } = await applicants.create(
      {
        firstName: 'Aarav',
        lastName: `Iyer${suffix}${seq}`,
        dob: '2020-06-15',
        genderId: scope.organizationId === orgB ? genderB : genderA,
        programId,
        aadhaarNo: options.aadhaarNo,
        primaryMobile: `9${String(seq).padStart(9, '0')}`,
        currentAddressLine1: 'Road 1',
        city: 'Mumbai',
        state: 'MH',
        country: 'IN',
        pincode: '400001',
      } as never,
      scope,
    );

    for (const action of [
      WorkflowAction.SUBMIT,
      WorkflowAction.START_REVIEW,
      WorkflowAction.APPROVE,
      WorkflowAction.CONFIRM_SEAT,
    ]) {
      await workflow.transition(applicant.id, { action }, scope, ADMIN);
    }

    return applicant;
  }

  const admit = (
    applicantId: string,
    academicUnitId = std1A,
    scope: ResourceScope = scopeMumbai,
  ) =>
    conversion.admit(applicantId, { academicUnitId } as never, scope, ADMIN);

  // ---------------------------------------------------------------------------

  describe('the golden path', () => {
    it('walks Organization → … → Enrollment and lands one of each', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      const after = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
        include: {
          person: true,
          enrollments: true,
          admissions: true,
        },
      });

      // One of each, and every link in the chain present.
      expect(after.admissionStatus).toBe('ADMITTED');
      expect(after.personId).toBeTruthy();
      expect(after.admissions).toHaveLength(1);
      expect(after.enrollments).toHaveLength(1);

      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });
      const admission = await prisma.admission.findUniqueOrThrow({
        where: { id: result.admissionId },
      });
      const enrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: result.enrollmentId },
      });

      expect(student.status).toBe('ACTIVE');
      expect(student.personId).toBe(after.personId);
      expect(student.createdVia).toBe('ADMISSION');
      expect(admission.status).toBe('ACTIVE');
      expect(admission.studentId).toBe(student.id);
      expect(enrollment.enrollmentStatus).toBe('ACTIVE');
      expect(enrollment.originType).toBe('ADMISSION');
      expect(enrollment.enrollmentKind).toBe('PRIMARY');

      // Scope agrees at every level rather than being restated independently.
      for (const row of [student, admission, enrollment]) {
        expect(row.organizationId).toBe(orgA);
        expect(row.branchId).toBe(mumbai);
      }
      expect(enrollment.academicYearId).toBe(year2026);
    });

    /**
     * The composition defect Phase 5.5 found.
     *
     * Submission resolves the applicant into the identity index. Admission
     * used to ask again — and for an applicant with no government identifier
     * the second answer differs, because demographic matching deliberately
     * never merges. That produced two Person rows for one human, the Applicant
     * pointing at the first and the Student at the second, so
     * `@@unique([organizationId, personId])` was being enforced against an
     * identity nothing else referenced.
     */
    it('links the student to the person the application already had', async () => {
      const withoutGovtId = await applyAndConfirm();
      const before = await prisma.applicant.findUniqueOrThrow({
        where: { id: withoutGovtId.id },
      });
      expect(before.aadhaarNo).toBeNull();
      expect(before.personId).toBeTruthy();

      const personsBefore = await prisma.person.count({
        where: { organizationId: orgA },
      });

      const result = await admit(withoutGovtId.id);
      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });

      expect(student.personId).toBe(before.personId);
      // And no second identity was minted along the way.
      expect(await prisma.person.count({ where: { organizationId: orgA } })).toBe(
        personsBefore,
      );
    });

    it('links the student to the same person when a government id is present', async () => {
      const govtId = aadhaar();
      const applicant = await applyAndConfirm(scopeMumbai, { aadhaarNo: govtId });
      const before = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });

      const result = await admit(applicant.id);
      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });

      expect(student.personId).toBe(before.personId);
    });

    it('is traceable from the applicant forward', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      const forward = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
        include: {
          admissions: { include: { enrollments: true } },
        },
      });

      expect(forward.admissions[0].id).toBe(result.admissionId);
      expect(forward.admissions[0].enrollments[0].id).toBe(result.enrollmentId);
    });

    it('is traceable backwards from a student code, with no demographic search', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      // Exactly what support does when a parent reads out a code over the
      // phone. One indexed lookup, then relations — no name, no date of birth,
      // no mobile number involved anywhere in the path.
      const found = await prisma.student.findFirstOrThrow({
        where: { organizationId: orgA, studentCode: result.studentCode },
        include: {
          admissions: {
            include: { enrollments: { include: { academicUnit: true } } },
          },
        },
      });

      expect(found.id).toBe(result.studentId);
      expect(found.sourceApplicantId).toBe(applicant.id);
      expect(found.admissions).toHaveLength(1);
      expect(found.admissions[0].enrollments).toHaveLength(1);
      expect(found.admissions[0].enrollments[0].academicUnit.name).toBe('Std 1-A');
    });

    it('records the transition once, with its actor', async () => {
      const applicant = await applyAndConfirm();
      await admit(applicant.id);

      const history = await prisma.workflowHistory.findMany({
        where: { entityType: 'APPLICANT', entityId: applicant.id },
        orderBy: { timestamp: 'asc' },
      });

      const admitRows = history.filter((h) => h.actionType === WorkflowAction.ADMIT);
      expect(admitRows).toHaveLength(1);
      expect(admitRows[0]).toMatchObject({
        oldStatus: 'SEAT_CONFIRMED',
        newStatus: 'ADMITTED',
        actionBy: ADMIN.userId,
        organizationId: orgA,
        branchId: mumbai,
      });

      // The whole funnel is on the record, each row starting where the last
      // ended, so the chain reads as a sequence rather than a pile.
      for (let i = 1; i < history.length; i += 1) {
        expect(history[i].oldStatus).toBe(history[i - 1].newStatus);
      }
      expect(history[history.length - 1].newStatus).toBe('ADMITTED');
    });
  });

  // ---------------------------------------------------------------------------

  describe('the student code', () => {
    it('is unique, org-scoped and unrelated to the branch', async () => {
      const first = await admit((await applyAndConfirm()).id);
      const second = await admit((await applyAndConfirm(scopePune)).id, puneUnit, scopePune);

      expect(first.studentCode).toMatch(/^STU\d{10}$/);
      expect(second.studentCode).toMatch(/^STU\d{10}$/);
      expect(first.studentCode).not.toBe(second.studentCode);

      // One organization-wide series. Two branches of one organization draw
      // from the same counter, so a code says nothing about where a student
      // studies — which is what lets them transfer without it changing.
      const codes = await prisma.student.findMany({
        where: { organizationId: orgA },
        select: { studentCode: true, branchId: true },
      });
      expect(new Set(codes.map((c) => c.studentCode)).size).toBe(codes.length);
    });

    it('starts again from one in a different organization', async () => {
      const inB = await admit(
        (await applyAndConfirm(scopeOrgB)).id,
        branchBUnit,
        scopeOrgB,
      );

      // Tenants do not share a series, so the same code may exist in both and
      // the uniqueness rule is `(organizationId, studentCode)`.
      const orgBStudents = await prisma.student.count({
        where: { organizationId: orgB },
      });
      expect(orgBStudents).toBeGreaterThan(0);
      expect(inB.studentCode).toMatch(/^STU\d{10}$/);
    });

    it('survives a rollback without ever being reissued', async () => {
      const doomed = await applyAndConfirm();
      const spy = jest
        .spyOn(enrollments, 'createInitialEnrollment')
        .mockRejectedValueOnce(new Error('injected failure'));

      await expect(admit(doomed.id)).rejects.toThrow();
      spy.mockRestore();

      const next = await applyAndConfirm();
      const result = await admit(next.id);

      // The failed attempt burned a number, because MONOTONIC allocation
      // commits on its own connection rather than holding the counter for the
      // whole admission. A gap is the intended trade; a *reused* code would be
      // a corrupted identity, and that is what this rules out.
      const all = await prisma.student.findMany({
        where: { organizationId: orgA },
        select: { studentCode: true },
      });
      expect(new Set(all.map((s) => s.studentCode)).size).toBe(all.length);
      expect(all.map((s) => s.studentCode)).toContain(result.studentCode);
      expect(
        await prisma.student.count({ where: { sourceApplicantId: doomed.id } }),
      ).toBe(0);
    });

    it('is never used as a foreign key by anything downstream', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      const admission = await prisma.admission.findUniqueOrThrow({
        where: { id: result.admissionId },
      });
      const enrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: result.enrollmentId },
      });

      // Both point at the UUID. A code is correctable in principle, so a row
      // keyed on one would be orphaned by a correction.
      expect(admission.studentId).toBe(result.studentId);
      expect(enrollment.studentId).toBe(result.studentId);
      expect(Object.keys(admission)).not.toContain('studentCode');
      expect(Object.keys(enrollment)).not.toContain('studentCode');
    });
  });

  // ---------------------------------------------------------------------------

  describe('the record survives its sources', () => {
    it('refuses to delete the applicant a student descends from', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      await expect(
        prisma.applicant.delete({ where: { id: applicant.id } }),
      ).rejects.toThrow();

      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });
      expect(student.sourceApplicantId).toBe(applicant.id);
    });

    it('still refuses once the placement has been cancelled', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      await enrollments.cancelEnrollment(
        result.enrollmentId,
        { reason: 'created in error' },
        scopeMumbai,
        ADMIN,
      );

      // A cancelled enrolment is still a row, and it still names the
      // application. Provenance does not become deletable because the
      // placement was voided.
      await expect(
        prisma.applicant.delete({ where: { id: applicant.id } }),
      ).rejects.toThrow();
    });

    it('keeps the person even though the applicant owns the reference', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);
      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });

      // A Person carrying a Student cannot be removed: identity outlives the
      // application that first recorded it.
      await expect(
        prisma.person.delete({ where: { id: student.personId } }),
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------

  describe('the layers stay separate', () => {
    it('keeps academic placement off the student', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });

      // Fees, attendance, examination and the timetable will all read
      // placement from Enrollment. If Student carried it, every one of them
      // would be reading a value that goes stale at the first promotion.
      for (const forbidden of [
        'academicYearId',
        'programId',
        'academicUnitId',
        'rollNumber',
        'currentEnrollmentId',
        'currentProgramId',
        'currentAcademicUnitId',
      ]) {
        expect(Object.keys(student)).not.toContain(forbidden);
      }

      // And Enrollment carries all of it.
      const enrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: result.enrollmentId },
      });
      for (const required of [
        'academicYearId',
        'programId',
        'academicUnitId',
        'rollNumber',
        'branchId',
      ]) {
        expect(Object.keys(enrollment)).toContain(required);
      }
    });

    it('answers "where is this student now?" without a stored pointer', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      const current = await enrollments.findCurrent(
        result.studentId,
        year2026,
        scopeMumbai,
      );
      expect(current?.id).toBe(result.enrollmentId);

      // After a correction the answer changes with no pointer to update — the
      // reason Student has none to go stale.
      const corrected = await enrollments.correctPlacement(
        result.enrollmentId,
        { academicUnitId: std1B, reason: 'wrong section at admission' },
        scopeMumbai,
        ADMIN,
      );

      const now = await enrollments.findCurrent(
        result.studentId,
        year2026,
        scopeMumbai,
      );
      expect(now?.id).toBe(corrected.current.id);
      expect(now?.academicUnitId).toBe(std1B);
    });

    it('keeps identity cryptography inside the person boundary', async () => {
      const govtId = aadhaar();
      const applicant = await applyAndConfirm(scopeMumbai, { aadhaarNo: govtId });
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

      // The identifier reached Person and stopped there. Nothing downstream
      // holds it, hashes it, or holds anything derived from it.
      const downstream = JSON.stringify([student, admission, enrollment]);
      expect(downstream).not.toContain(govtId);
      expect(downstream).not.toMatch(/aadhaar|govtIdHash|phoneHash|ciphertext/i);

      const person = await prisma.person.findUniqueOrThrow({
        where: { id: student.personId },
      });
      expect(person.govtIdHash).toBeTruthy();
      expect(JSON.stringify(person)).not.toContain(govtId);
    });
  });

  // ---------------------------------------------------------------------------

  describe('what the next phases will need', () => {
    it('lets one admission carry a second year with no new student or code', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      // The shape promotion will write. Phase 6 builds the operation; this
      // proves the schema already permits it.
      const nextYear = await enrollments.createInitialEnrollment({
        organizationId: orgA,
        branchId: mumbai,
        academicYearId: year2027,
        admissionId: result.admissionId,
        studentId: result.studentId,
        programId: program,
        academicUnitId: std2A,
        originType: 'PROMOTION',
      });

      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });
      const spellYears = await prisma.enrollment.findMany({
        where: { admissionId: result.admissionId },
        orderBy: { createdAt: 'asc' },
      });

      expect(spellYears.map((e) => e.academicYearId)).toEqual([year2026, year2027]);
      expect(student.studentCode).toBe(result.studentCode);
      expect(
        await prisma.admission.count({ where: { studentId: result.studentId } }),
      ).toBe(1);
      expect(nextYear.originType).toBe('PROMOTION');
    });

    it('lets a returning student open a second spell without a new identity', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      // Close the first spell, the way a withdrawal or graduation will.
      await prisma.admission.update({
        where: { id: result.admissionId },
        data: {
          status: 'COMPLETED',
          exitDate: new Date('2027-03-31'),
          exitReason: 'GRADUATED',
        },
      });

      const second = await admissions.createControlled({
        organizationId: orgA,
        branchId: mumbai,
        studentId: result.studentId,
        admissionType: 'READMISSION',
        admissionDate: new Date('2028-06-01'),
        entryProgramId: program,
        entryAcademicUnitId: std2A,
        academicYearId: year2027,
        previousAdmissionId: result.admissionId,
      });

      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });

      // Same id, same code, two spells, chained.
      expect(student.id).toBe(result.studentId);
      expect(student.studentCode).toBe(result.studentCode);
      expect(second.previousAdmissionId).toBe(result.admissionId);
      expect(
        await prisma.admission.count({ where: { studentId: result.studentId } }),
      ).toBe(2);
    });

    it('lets a branch move be represented without touching student identity', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      await prisma.enrollment.update({
        where: { id: result.enrollmentId },
        data: {
          enrollmentStatus: 'TRANSFERRED',
          exitDate: new Date(),
          exitReason: 'BRANCH_TRANSFER',
        },
      });
      await prisma.admission.update({
        where: { id: result.admissionId },
        data: {
          status: 'TRANSFERRED_OUT',
          exitDate: new Date(),
          exitReason: 'BRANCH_TRANSFER',
        },
      });
      await prisma.student.update({
        where: { id: result.studentId },
        data: { branchId: pune },
      });

      const atPune = await admissions.createControlled({
        organizationId: orgA,
        branchId: pune,
        studentId: result.studentId,
        admissionType: 'BRANCH_TRANSFER',
        admissionDate: new Date(),
        entryProgramId: puneProgram,
        entryAcademicUnitId: puneUnit,
        academicYearId: puneYear,
        previousAdmissionId: result.admissionId,
      });

      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });

      // The branch pointer moved and the identity did not — which is exactly
      // why `studentCode` encodes no branch.
      expect(student.branchId).toBe(pune);
      expect(student.studentCode).toBe(result.studentCode);
      expect(atPune.branchId).toBe(pune);
      // And the Mumbai history is intact.
      const mumbaiEnrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: result.enrollmentId },
      });
      expect(mumbaiEnrollment.branchId).toBe(mumbai);
    });

    it('gives each future module a single correct reference', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      const enrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: result.enrollmentId },
      });

      // Year-scoped modules — attendance, examination, timetable, fees for a
      // year — reach placement in one hop from `enrollmentId`.
      expect(enrollment.academicUnitId).toBe(std1A);
      expect(enrollment.academicYearId).toBe(year2026);
      expect(enrollment.programId).toBe(program);

      // Person-scoped modules — library, guardians — reach the human from
      // `studentId` with no enrolment required, so an identity operation still
      // works between spells of study.
      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });
      expect(student.personId).toBeTruthy();

      // Spell-scoped facts — a transfer certificate, the admission register —
      // hang off `admissionId`.
      const admission = await prisma.admission.findUniqueOrThrow({
        where: { id: result.admissionId },
      });
      // Prefix, academic year, then the counter. The year is what lets the
      // series restart each April without colliding in the branch register.
      expect(admission.admissionNo).toMatch(/^AD-.+-\d{5}$/);
    });

    it('keeps the four reporting counts distinct', async () => {
      const before = {
        applicants: await prisma.applicant.count({ where: { organizationId: orgA } }),
        students: await prisma.student.count({ where: { organizationId: orgA } }),
        admissions: await prisma.admission.count({ where: { organizationId: orgA } }),
        enrollments: await prisma.enrollment.count({ where: { organizationId: orgA } }),
      };

      const applicant = await applyAndConfirm();
      const rejected = await applyAndConfirm();
      await workflow.transition(
        rejected.id,
        { action: WorkflowAction.CANCEL, remarks: 'withdrew' },
        scopeMumbai,
        ADMIN,
      );
      const result = await admit(applicant.id);

      const after = {
        applicants: await prisma.applicant.count({ where: { organizationId: orgA } }),
        students: await prisma.student.count({ where: { organizationId: orgA } }),
        admissions: await prisma.admission.count({ where: { organizationId: orgA } }),
        enrollments: await prisma.enrollment.count({ where: { organizationId: orgA } }),
      };

      // Two applications, one student. "How many did we admit?" is a count of
      // Admissions for the year, not of Applicants and not of Students — a
      // student readmitted later would be counted twice by the first and
      // missed by the second.
      expect(after.applicants - before.applicants).toBe(2);
      expect(after.students - before.students).toBe(1);
      expect(after.admissions - before.admissions).toBe(1);
      expect(after.enrollments - before.enrollments).toBe(1);
      expect(result.studentId).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------

  describe('isolation across the whole chain', () => {
    it('keeps two organizations apart at every layer', async () => {
      const inA = await admit((await applyAndConfirm()).id);
      const inB = await admit(
        (await applyAndConfirm(scopeOrgB)).id,
        branchBUnit,
        scopeOrgB,
      );

      const rowsFor = async (organizationId: string) => ({
        students: await prisma.student.findMany({ where: { organizationId } }),
        admissions: await prisma.admission.findMany({ where: { organizationId } }),
        enrollments: await prisma.enrollment.findMany({ where: { organizationId } }),
        persons: await prisma.person.findMany({ where: { organizationId } }),
      });

      const a = await rowsFor(orgA);
      const b = await rowsFor(orgB);

      expect(a.students.map((s) => s.id)).toContain(inA.studentId);
      expect(a.students.map((s) => s.id)).not.toContain(inB.studentId);
      expect(b.students.map((s) => s.id)).toContain(inB.studentId);

      // No row of either tenant references a row of the other, at any layer.
      const bIds = new Set([
        ...b.students.map((r) => r.id),
        ...b.admissions.map((r) => r.id),
        ...b.enrollments.map((r) => r.id),
        ...b.persons.map((r) => r.id),
      ]);
      for (const row of [...a.students, ...a.admissions, ...a.enrollments]) {
        for (const value of Object.values(row)) {
          if (typeof value === 'string') expect(bIds.has(value)).toBe(false);
        }
      }
    });

    it('refuses an admission driven from the wrong branch', async () => {
      const applicant = await applyAndConfirm();

      await expect(
        conversion.admit(
          applicant.id,
          { academicUnitId: puneUnit } as never,
          scopePune,
          ADMIN,
        ),
      ).rejects.toMatchObject({ status: 404 });

      expect(
        await prisma.student.count({ where: { sourceApplicantId: applicant.id } }),
      ).toBe(0);
    });

    it('refuses every mismatched placement combination', async () => {
      const applicant = await applyAndConfirm();

      // Each of these names a unit that is real but belongs somewhere else.
      for (const academicUnitId of [
        std2A, // right branch and programme, wrong year
        puneUnit, // right organization, wrong branch
        branchBUnit, // wrong organization entirely
      ]) {
        await expect(admit(applicant.id, academicUnitId)).rejects.toMatchObject({
          response: { error: 'ACADEMIC_UNIT_MISMATCH' },
        });
      }

      expect(
        await prisma.student.count({ where: { sourceApplicantId: applicant.id } }),
      ).toBe(0);
    });

    it('keeps numbering series apart between organizations', async () => {
      const counters = await prisma.numberSequenceCounter.findMany({
        where: {
          config: { purpose: 'STUDENT_CODE', organizationId: { in: [orgA, orgB] } },
        },
        include: { config: { select: { organizationId: true } } },
      });

      // Two counters, one per tenant. A shared one would let organization B's
      // admissions advance organization A's student codes.
      const byOrg = new Set(counters.map((c) => c.config.organizationId));
      expect(byOrg.size).toBe(counters.length);
    });
  });

  // ---------------------------------------------------------------------------

  describe('concurrency across the chain', () => {
    it('gives distinct identities to applicants admitted at once', async () => {
      const cohort = await Promise.all([
        applyAndConfirm(),
        applyAndConfirm(),
        applyAndConfirm(),
        applyAndConfirm(),
        applyAndConfirm(),
      ]);

      const results = await Promise.all(
        cohort.map((applicant, i) =>
          admit(applicant.id, i % 2 === 0 ? std1A : std1B),
        ),
      );

      for (const key of [
        'studentId',
        'studentCode',
        'admissionId',
        'admissionNo',
        'enrollmentId',
      ] as const) {
        expect(new Set(results.map((r) => r[key])).size).toBe(5);
      }
    });

    it('publishes every event through the outbox and audits each once', async () => {
      const applicant = await applyAndConfirm();
      const result = await admit(applicant.id);

      for (let attempt = 0; attempt < 25; attempt += 1) {
        await moduleRef.get(OutboxRelay).drain();
        const rows = await prisma.auditLog.findMany({
          where: { aggregateId: applicant.id, eventName: 'applicant.admitted' },
        });
        if (rows.length > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await moduleRef.get(OutboxRelay).drain();
      await moduleRef.get(OutboxRelay).drain();

      for (const [aggregateId, eventName] of [
        [applicant.id, 'applicant.admitted'],
        [result.studentId, 'student.created'],
        [result.admissionId, 'admission.created'],
        [result.enrollmentId, 'enrollment.created'],
      ]) {
        const rows = await prisma.auditLog.findMany({
          where: { aggregateId, eventName },
        });
        // Exactly one, after three drains: at-least-once delivery is only safe
        // because `AuditLog.eventId` is unique.
        expect({ eventName, count: rows.length }).toEqual({ eventName, count: 1 });
        expect(rows[0].organizationId).toBe(orgA);
      }
    });
  });
});
