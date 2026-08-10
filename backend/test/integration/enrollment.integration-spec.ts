import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { EnrollmentService } from '@/modules/enrollment/enrollment.service';
import { AdmissionService } from '@/modules/admissions/admission/admission.service';
import { StudentService } from '@/modules/identity/student/student.service';
import { PersonService } from '@/modules/identity/person/person.service';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { OutboxRelay } from '@/infrastructure/outbox/outbox.relay';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { ResourceScope } from '@/common/scope/resource-scope';

/**
 * Phase 4 — academic placement against real Postgres.
 *
 * The composite foreign keys and the partial unique indexes are the point of
 * this file, and neither exists in a mock. Every "the database rejects this"
 * case goes through `$executeRawUnsafe` on purpose: a service can be bypassed
 * by the next module, by a migration or by a bug, and what survives all three
 * is what the server refuses to store.
 */
describe('Enrollment (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let enrollments: EnrollmentService;
  let admissions: AdmissionService;
  let students: StudentService;
  let persons: PersonService;
  let numbering: NumberingService;

  const suffix = Date.now().toString();
  let seq = 0;

  let orgId: string;
  let otherOrgId: string;
  let branchAId: string;
  let branchBId: string;
  let yearAId: string;
  let yearA2Id: string;
  let yearBId: string;
  let programAId: string;
  let programA2Id: string;
  let programBId: string;
  /** Two sections under programme A, in year A — the correction target pair. */
  let unitA1Id: string;
  let unitA2Id: string;
  /** A section under programme A2, in year A. */
  let unitA3Id: string;
  /** A section in year A2 — used to prove the year composite key bites. */
  let unitNextYearId: string;
  let unitBId: string;
  let genderId: string;

  let scopeA: ResourceScope;
  let scopeB: ResourceScope;

  const ADMIN = {
    userId: '00000000-0000-4000-8000-0000000000e1',
    role: 'SUPER_ADMIN',
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    enrollments = moduleRef.get(EnrollmentService);
    admissions = moduleRef.get(AdmissionService);
    students = moduleRef.get(StudentService);
    persons = moduleRef.get(PersonService);
    numbering = moduleRef.get(NumberingService);

    const makeOrg = async (label: string) =>
      (
        await prisma.organization.create({
          data: {
            name: `P4 ${label}`,
            code: `P4${label}_${suffix}`,
            contactEmail: 'p4@test.local',
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
            code: `P4B${label}_${suffix}`,
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
    yearA2Id = await makeYear(branchAId, '2027');
    yearBId = await makeYear(branchBId, '2026');

    programAId = await makeProgram(branchAId, `Std 1 ${suffix}`);
    programA2Id = await makeProgram(branchAId, `Std 1 Marathi ${suffix}`);
    programBId = await makeProgram(branchBId, `Std 1 B ${suffix}`);

    unitA1Id = await makeUnit(branchAId, programAId, yearAId, 'Std 1-A');
    unitA2Id = await makeUnit(branchAId, programAId, yearAId, 'Std 1-B');
    unitA3Id = await makeUnit(branchAId, programA2Id, yearAId, 'Std 1-M');
    unitNextYearId = await makeUnit(branchAId, programAId, yearA2Id, 'Std 2-A');
    unitBId = await makeUnit(branchBId, programBId, yearBId, 'Std 1-BB');

    genderId = (
      await prisma.gender.create({
        data: { organizationId: orgId, code: `P4G_${suffix}`, name: `G ${suffix}` },
      })
    ).id;

    for (const branchId of [branchAId, branchBId]) {
      await numbering.createConfig(
        {
          purpose: 'ADMISSION_NO',
          prefix: 'AD',
          sequencePadding: 5,
          format: '{prefix}-{sequence}',
        },
        orgId,
        branchId,
      );
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
    scopeB = { organizationId: orgId, branchId: branchBId, academicYearId: yearBId };
  });

  afterAll(async () => {
    for (const org of [orgId, otherOrgId]) {
      await prisma.auditLog.deleteMany({ where: { organizationId: org } });
      await prisma.outboxEvent.deleteMany({ where: { organizationId: org } });
      await prisma.workflowHistory.deleteMany({ where: { organizationId: org } });
      // Enrolments chain to each other, so break the links before deleting —
      // and every CHECK has to hold on the way out. CANCELLED is the one
      // status that satisfies all of them at once: the supersede rule wants a
      // successor only for SUPERSEDED, the exit-pair rule is met by the date
      // and reason below, the provenance rule by resetting the origin, and
      // CANCELLED is excluded from the one-live-placement index, so rows that
      // shared an admission and a year do not collide on the way to deletion.
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
      await prisma.applicant.deleteMany({ where: { organizationId: org } });
      await prisma.admission.updateMany({
        where: { organizationId: org },
        data: { previousAdmissionId: null },
      });
      await prisma.admission.deleteMany({ where: { organizationId: org } });
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

  afterEach(async () => {
    await prisma.academicYear.updateMany({
      where: { branchId: branchAId },
      data: { isLocked: false },
    });
  });

  // ---------------------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------------------

  /** A student with an open admission at the given branch. */
  async function admittedStudent(branchId = branchAId) {
    seq += 1;
    const { personId } = await persons.resolve(orgId, {
      firstName: 'Learner',
      lastName: `Person${suffix}${seq}`,
      dob: new Date('2015-04-12'),
      phone: `9${String(seq).padStart(9, '0')}`,
    });

    const student = await students.createControlled({
      organizationId: orgId,
      branchId,
      personId,
      firstName: 'Learner',
      lastName: `Person${suffix}${seq}`,
      dob: new Date('2015-04-12'),
      genderId,
      createdVia: 'MIGRATION',
    });

    const admission = await admissions.createControlled({
      organizationId: orgId,
      branchId,
      studentId: student.id,
      admissionType: 'REGULAR',
      admissionDate: new Date('2026-06-01'),
      entryProgramId: branchId === branchAId ? programAId : programBId,
      entryAcademicUnitId: branchId === branchAId ? unitA1Id : unitBId,
      academicYearId: branchId === branchAId ? yearAId : yearBId,
    });

    return { student, admission };
  }

  /** A live placement, created the way Phase 5 will create it. */
  async function placed(
    overrides: Partial<{
      branchId: string;
      academicYearId: string;
      programId: string;
      academicUnitId: string;
      rollNumber: string | null;
    }> = {},
  ) {
    const branchId = overrides.branchId ?? branchAId;
    const { student, admission } = await admittedStudent(branchId);

    const enrollment = await enrollments.createInitialEnrollment({
      organizationId: orgId,
      branchId,
      academicYearId:
        overrides.academicYearId ?? (branchId === branchAId ? yearAId : yearBId),
      admissionId: admission.id,
      studentId: student.id,
      programId:
        overrides.programId ?? (branchId === branchAId ? programAId : programBId),
      academicUnitId:
        overrides.academicUnitId ?? (branchId === branchAId ? unitA1Id : unitBId),
      rollNumber: overrides.rollNumber ?? null,
    });

    return { student, admission, enrollment };
  }

  /** Insert an Enrollment straight into Postgres, bypassing every service. */
  function rawInsert(values: Record<string, unknown>) {
    const row = {
      id: `raw-${suffix}-${(seq += 1)}`,
      organizationId: orgId,
      branchId: branchAId,
      academicYearId: yearAId,
      programId: programAId,
      academicUnitId: unitA1Id,
      enrollmentKind: 'PRIMARY',
      enrollmentStatus: 'ACTIVE',
      originType: 'ADMISSION',
      isRepeat: false,
      version: 1,
      ...values,
    };

    const columns = Object.keys(row);
    const params = columns.map((_, i) => `$${i + 1}`);
    const casts = columns
      .map((c, i) => {
        if (c === 'enrollmentKind') return `${params[i]}::"EnrollmentKind"`;
        if (c === 'enrollmentStatus') return `${params[i]}::"EnrollmentStatus"`;
        if (c === 'originType') return `${params[i]}::"EnrollmentOriginType"`;
        if (c === 'exitReason') return `${params[i]}::"AdmissionExitReason"`;
        return params[i];
      })
      .join(', ');

    return prisma.$executeRawUnsafe(
      `INSERT INTO "Enrollment" (${columns.map((c) => `"${c}"`).join(', ')}, "updatedAt")
       VALUES (${casts}, now())`,
      ...Object.values(row),
    );
  }

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

  describe('what the database refuses', () => {
    it('rejects an enrolment whose student is not its admission’s student', async () => {
      const a = await admittedStudent();
      const b = await admittedStudent();

      // The single most important key in the model: one foreign key carrying
      // two invariants. Without it, a service bug silently attributes a
      // placement to the wrong child.
      await expect(
        rawInsert({ admissionId: a.admission.id, studentId: b.student.id }),
      ).rejects.toThrow(/Enrollment_admissionId_studentId_branchId_fkey/);
    });

    it('rejects an enrolment whose branch is not its admission’s branch', async () => {
      const a = await admittedStudent(branchAId);

      await expect(
        rawInsert({
          admissionId: a.admission.id,
          studentId: a.student.id,
          branchId: branchBId,
          academicYearId: yearBId,
          programId: programBId,
          academicUnitId: unitBId,
        }),
      ).rejects.toThrow(/Enrollment_admissionId_studentId_branchId_fkey/);
    });

    it('rejects a unit belonging to a different academic year', async () => {
      const a = await admittedStudent();

      // INV-ENR-010. `academicYearId` denormalizes the unit's own year, and the
      // composite key is what keeps the copy honest.
      await expect(
        rawInsert({
          admissionId: a.admission.id,
          studentId: a.student.id,
          academicYearId: yearAId,
          academicUnitId: unitNextYearId,
        }),
      ).rejects.toThrow(/academicUnitId/);
    });

    it('rejects a unit belonging to a different programme', async () => {
      const a = await admittedStudent();

      await expect(
        rawInsert({
          admissionId: a.admission.id,
          studentId: a.student.id,
          programId: programAId,
          academicUnitId: unitA3Id,
        }),
      ).rejects.toThrow(/academicUnitId/);
    });

    it('rejects a unit belonging to another branch', async () => {
      const a = await admittedStudent();

      await expect(
        rawInsert({
          admissionId: a.admission.id,
          studentId: a.student.id,
          academicUnitId: unitBId,
        }),
      ).rejects.toThrow(/academicUnitId/);
    });

    it('rejects a programme from another branch', async () => {
      const a = await admittedStudent();

      await expect(
        rawInsert({
          admissionId: a.admission.id,
          studentId: a.student.id,
          programId: programBId,
        }),
      ).rejects.toThrow(/programId|academicUnitId/);
    });

    it('rejects a second live PRIMARY placement for one admission and year', async () => {
      const { admission, student } = await placed();

      await expect(
        rawInsert({
          admissionId: admission.id,
          studentId: student.id,
          academicUnitId: unitA2Id,
        }),
      ).rejects.toThrow(/"admissionId", "academicYearId"/);
    });

    it('allows the superseded row to share the admission and year', async () => {
      const { enrollment } = await placed();

      await enrollments.correctPlacement(
        enrollment.id,
        { academicUnitId: unitA2Id, reason: 'wrong class at admission' },
        scopeA,
        ADMIN,
      );

      // The exclusion of SUPERSEDED from index 4 is the single most likely
      // omission in the whole schema: without it, correction is impossible,
      // because the old row and its replacement necessarily share both keys.
      const rows = await prisma.enrollment.findMany({
        where: { admissionId: enrollment.admissionId },
      });
      expect(rows).toHaveLength(2);
      expect(rows.filter((r) => r.enrollmentStatus === 'ACTIVE')).toHaveLength(1);
    });

    it('rejects a duplicate roll number within one class and year', async () => {
      const first = await placed({ rollNumber: '17' });
      const second = await placed();

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "Enrollment" SET "rollNumber" = '17' WHERE "id" = $1`,
          second.enrollment.id,
        ),
      ).rejects.toThrow(/"academicUnitId", "academicYearId", "rollNumber"/);

      expect(first.enrollment.rollNumber).toBe('17');
    });

    it('allows the same roll number in a different class', async () => {
      await placed({ rollNumber: '1' });
      const other = await placed({
        programId: programA2Id,
        academicUnitId: unitA3Id,
      });

      // Std 1-A Roll 1 and Std 1-M Roll 1 are both valid. A roll number is a
      // position in one register, not an identifier.
      await expect(
        enrollments.assignRollNumber(
          other.enrollment.id,
          { rollNumber: '1' },
          scopeA,
          ADMIN,
        ),
      ).resolves.toMatchObject({ rollNumber: '1' });
    });

    it('rejects a SUPERSEDED row with no successor or no reason', async () => {
      const a = await admittedStudent();

      await expect(
        rawInsert({
          admissionId: a.admission.id,
          studentId: a.student.id,
          enrollmentStatus: 'SUPERSEDED',
        }),
      ).rejects.toThrow(/enrollment_supersede_check/);
    });

    it('rejects a correction that names no predecessor', async () => {
      const a = await admittedStudent();

      await expect(
        rawInsert({
          admissionId: a.admission.id,
          studentId: a.student.id,
          originType: 'CORRECTION',
          changeReason: 'a reason without a predecessor',
        }),
      ).rejects.toThrow(/enrollment_provenance_check/);
    });

    it('rejects a blank change reason', async () => {
      const { enrollment } = await placed();

      // `NOT NULL` alone accepts "   ", which is how a mandatory-reason field
      // becomes a mandatory-keystroke field.
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "Enrollment"
             SET "enrollmentStatus" = 'SUPERSEDED', "supersededById" = NULL, "changeReason" = '   '
           WHERE "id" = $1`,
          enrollment.id,
        ),
      ).rejects.toThrow(/enrollment_supersede_check/);
    });

    it('rejects a placement that follows or replaces itself', async () => {
      const { enrollment } = await placed();

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "Enrollment" SET "previousEnrollmentId" = "id" WHERE "id" = $1`,
          enrollment.id,
        ),
      ).rejects.toThrow(/enrollment_no_self_chain_check/);

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "Enrollment" SET "supersededById" = "id" WHERE "id" = $1`,
          enrollment.id,
        ),
      ).rejects.toThrow(/enrollment_no_self_chain_check/);
    });

    it('rejects a cancelled placement with no exit date or reason', async () => {
      const { enrollment } = await placed();

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "Enrollment" SET "enrollmentStatus" = 'CANCELLED' WHERE "id" = $1`,
          enrollment.id,
        ),
      ).rejects.toThrow(/enrollment_exit_pair_check/);
    });

    it('rejects an exit that predates the placement', async () => {
      const { enrollment } = await placed();

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "Enrollment"
             SET "enrollmentStatus" = 'DROPPED_OUT',
                 "exitDate" = '2000-01-01'::timestamp,
                 "exitReason" = 'DROPPED_OUT'
           WHERE "id" = $1`,
          enrollment.id,
        ),
      ).rejects.toThrow(/enrollment_exit_order_check/);
    });

    it('rejects a blank roll number', async () => {
      const { enrollment } = await placed();

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "Enrollment" SET "rollNumber" = '  ' WHERE "id" = $1`,
          enrollment.id,
        ),
      ).rejects.toThrow(/enrollment_rollno_nonblank_check/);
    });

    it('rejects two rows claiming the same successor', async () => {
      const first = await placed();
      const second = await placed();
      const target = await placed();

      await prisma.$executeRawUnsafe(
        `UPDATE "Enrollment"
           SET "enrollmentStatus" = 'SUPERSEDED', "supersededById" = $2, "changeReason" = 'first'
         WHERE "id" = $1`,
        first.enrollment.id,
        target.enrollment.id,
      );

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "Enrollment"
             SET "enrollmentStatus" = 'SUPERSEDED', "supersededById" = $2, "changeReason" = 'second'
           WHERE "id" = $1`,
          second.enrollment.id,
          target.enrollment.id,
        ),
      ).rejects.toThrow(/supersededById/i);
    });
  });

  // ---------------------------------------------------------------------------

  describe('the academic record survives its sources', () => {
    it('refuses to delete an applicant a placement descends from', async () => {
      const { student, admission } = await admittedStudent();

      const applicant = await prisma.applicant.create({
        data: {
          organizationId: orgId,
          branchId: branchAId,
          academicYearId: yearAId,
          firstName: 'Prov',
          lastName: `Enance${suffix}`,
          displayName: 'Prov Enance',
          dob: new Date('2015-04-12'),
          genderId,
          primaryMobile: '9998887771',
          currentAddressLine1: 'Road 1',
          city: 'Mumbai',
          state: 'MH',
          country: 'IN',
          pincode: '400001',
          admissionFormNo: `PRV-${suffix}`,
          applicationNo: `PRVA-${suffix}`,
        },
      });

      await enrollments.createInitialEnrollment({
        organizationId: orgId,
        branchId: branchAId,
        academicYearId: yearAId,
        admissionId: admission.id,
        studentId: student.id,
        programId: programAId,
        academicUnitId: unitA1Id,
        applicantId: applicant.id,
      });

      // RESTRICT, not SET NULL: nulling the pointer would erase the provenance
      // rather than refuse the deletion, and an application a whole school
      // career descends from is not deletable.
      await expect(
        prisma.applicant.delete({ where: { id: applicant.id } }),
      ).rejects.toThrow();

      const survivors = await prisma.enrollment.findMany({
        where: { applicantId: applicant.id },
      });
      expect(survivors).toHaveLength(1);
      expect(survivors[0].applicantId).toBe(applicant.id);
    });

    it('lets one admission hold a placement in every year', async () => {
      const { student, admission } = await admittedStudent();

      await enrollments.createInitialEnrollment({
        organizationId: orgId,
        branchId: branchAId,
        academicYearId: yearAId,
        admissionId: admission.id,
        studentId: student.id,
        programId: programAId,
        academicUnitId: unitA1Id,
      });

      // The Phase 0 shape made this impossible — `applicantId @unique` meant
      // one enrolment per applicant for life, so a twelve-year school career
      // could not be represented and promotion had nowhere to go.
      await enrollments.createInitialEnrollment({
        organizationId: orgId,
        branchId: branchAId,
        academicYearId: yearA2Id,
        admissionId: admission.id,
        studentId: student.id,
        programId: programAId,
        academicUnitId: unitNextYearId,
        originType: 'PROMOTION',
      });

      const history = await enrollments.findByAdmission(admission.id, scopeA);
      expect(history).toHaveLength(2);
      expect(history.map((e) => e.academicYearId)).toEqual([yearAId, yearA2Id]);
      // One student, one admission, two thin rows, zero demographics copied.
      expect(new Set(history.map((e) => e.studentId)).size).toBe(1);
    });

    it('has no hard-delete path', async () => {
      const { enrollment } = await placed();

      await enrollments.cancelEnrollment(
        enrollment.id,
        { reason: 'duplicate created in error' },
        scopeA,
        ADMIN,
      );

      const survivor = await prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollment.id },
      });
      expect(survivor.enrollmentStatus).toBe('CANCELLED');
      expect(survivor.exitDate).not.toBeNull();
      expect(survivor.exitReason).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------

  describe('concurrency', () => {
    it('lets exactly one of twenty simultaneous corrections win', async () => {
      const { enrollment } = await placed();

      const results = await Promise.allSettled(
        Array.from({ length: 20 }, (_, i) =>
          enrollments.correctPlacement(
            enrollment.id,
            { academicUnitId: unitA2Id, reason: `attempt ${i}` },
            scopeA,
            ADMIN,
          ),
        ),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const rows = await prisma.enrollment.findMany({
        where: { admissionId: enrollment.admissionId },
        orderBy: { createdAt: 'asc' },
      });

      // Nineteen orphan replacements is what happens without the lock-first
      // ordering, and each one satisfies every constraint on its own.
      expect(rows).toHaveLength(2);
      expect(rows[0].enrollmentStatus).toBe('SUPERSEDED');
      expect(rows[1].enrollmentStatus).toBe('ACTIVE');
      expect(rows[0].supersededById).toBe(rows[1].id);
      expect(rows[1].previousEnrollmentId).toBe(rows[0].id);
    });

    it('lets exactly one of ten simultaneous transfers win', async () => {
      const { enrollment } = await placed();

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () =>
          enrollments.transferPlacement(
            enrollment.id,
            { academicUnitId: unitA2Id, reason: 'section change' },
            scopeA,
            ADMIN,
          ),
        ),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const active = await prisma.enrollment.findMany({
        where: { admissionId: enrollment.admissionId, enrollmentStatus: 'ACTIVE' },
      });
      expect(active).toHaveLength(1);
      expect(active[0].academicUnitId).toBe(unitA2Id);
      expect(active[0].originType).toBe('TRANSFER');
    });

    it('produces one coherent history from a cancel, a correct and a transfer', async () => {
      const { enrollment } = await placed();

      const results = await Promise.allSettled([
        enrollments.cancelEnrollment(
          enrollment.id,
          { reason: 'void' },
          scopeA,
          ADMIN,
        ),
        enrollments.correctPlacement(
          enrollment.id,
          { academicUnitId: unitA2Id, reason: 'wrong class' },
          scopeA,
          ADMIN,
        ),
        enrollments.transferPlacement(
          enrollment.id,
          { academicUnitId: unitA2Id, reason: 'section change' },
          scopeA,
          ADMIN,
        ),
      ]);

      // Exactly one wins: all three close the row, and none of the three is
      // reachable from where the others land.
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const rows = await prisma.enrollment.findMany({
        where: { admissionId: enrollment.admissionId },
      });
      expect(rows.filter((r) => r.enrollmentStatus === 'ACTIVE').length).toBeLessThanOrEqual(1);

      const original = rows.find((r) => r.id === enrollment.id)!;
      expect(['CANCELLED', 'SUPERSEDED']).toContain(original.enrollmentStatus);
      if (original.enrollmentStatus === 'CANCELLED') {
        expect(original.supersededById).toBeNull();
        expect(rows).toHaveLength(1);
      } else {
        expect(original.supersededById).not.toBeNull();
        expect(rows).toHaveLength(2);
      }
    });

    it('rejects the loser of a concurrent roll-number assignment', async () => {
      const a = await placed();
      const b = await placed();

      const results = await Promise.allSettled([
        enrollments.assignRollNumber(
          a.enrollment.id,
          { rollNumber: '21' },
          scopeA,
          ADMIN,
        ),
        enrollments.assignRollNumber(
          b.enrollment.id,
          { rollNumber: '21' },
          scopeA,
          ADMIN,
        ),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const loser = results.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      expect(errorCode(loser?.reason)).toBe('ROLL_NUMBER_TAKEN');

      const taken = await prisma.enrollment.findMany({
        where: { academicUnitId: unitA1Id, academicYearId: yearAId, rollNumber: '21' },
      });
      expect(taken).toHaveLength(1);
    });

    it('refuses a second initial placement for the same admission and year', async () => {
      const { student, admission } = await admittedStudent();

      const create = () =>
        enrollments.createInitialEnrollment({
          organizationId: orgId,
          branchId: branchAId,
          academicYearId: yearAId,
          admissionId: admission.id,
          studentId: student.id,
          programId: programAId,
          academicUnitId: unitA1Id,
        });

      const results = await Promise.allSettled([create(), create()]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const loser = results.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      // A controlled business error, not a leaked P2002.
      expect(errorCode(loser?.reason)).toBe('ENROLLMENT_EXISTS_FOR_YEAR');
    });
  });

  // ---------------------------------------------------------------------------

  describe('the academic year lock', () => {
    const lock = (isLocked: boolean) =>
      prisma.academicYear.update({
        where: { id: yearAId },
        data: { isLocked },
      });

    it('accepts writes while the year is open', async () => {
      const { enrollment } = await placed();

      await expect(
        enrollments.assignRollNumber(
          enrollment.id,
          { rollNumber: '5' },
          scopeA,
          ADMIN,
        ),
      ).resolves.toBeDefined();
    });

    it('refuses every write path once the year is locked', async () => {
      const { enrollment } = await placed();
      const { student, admission } = await admittedStudent();
      await lock(true);

      const attempts: Array<[string, Promise<unknown>]> = [
        [
          'create',
          enrollments.createInitialEnrollment({
            organizationId: orgId,
            branchId: branchAId,
            academicYearId: yearAId,
            admissionId: admission.id,
            studentId: student.id,
            programId: programAId,
            academicUnitId: unitA1Id,
          }),
        ],
        [
          'correct',
          enrollments.correctPlacement(
            enrollment.id,
            { academicUnitId: unitA2Id, reason: 'wrong class' },
            scopeA,
            ADMIN,
          ),
        ],
        [
          'transfer',
          enrollments.transferPlacement(
            enrollment.id,
            { academicUnitId: unitA2Id, reason: 'section change' },
            scopeA,
            ADMIN,
          ),
        ],
        [
          'cancel',
          enrollments.cancelEnrollment(
            enrollment.id,
            { reason: 'void' },
            scopeA,
            ADMIN,
          ),
        ],
      ];

      for (const [name, attempt] of attempts) {
        const caught = await attempt.catch((e: unknown) => e);
        expect({ name, code: errorCode(caught) }).toEqual({
          name,
          code: 'ACADEMIC_YEAR_LOCKED',
        });
        expect(caught).toBeInstanceOf(ForbiddenException);
      }

      // Roll numbers refuse under their own rule, which today derives from the
      // year lock and will be a finer per-class-list lock once F2 lands.
      await expect(
        enrollments.assignRollNumber(
          enrollment.id,
          { rollNumber: '9' },
          scopeA,
          ADMIN,
        ),
      ).rejects.toMatchObject({ response: { error: 'CLASS_LIST_LOCKED' } });
    });

    it('never lets a write commit into a year that locked underneath it', async () => {
      const { enrollment } = await placed();

      // The share lock the correction takes on the year blocks the UPDATE that
      // sets isLocked, so the two serialise instead of interleaving. Whichever
      // order they take, a committed correction and a locked year cannot both
      // describe the same instant.
      const [correction] = await Promise.allSettled([
        enrollments.correctPlacement(
          enrollment.id,
          { academicUnitId: unitA2Id, reason: 'racing the lock' },
          scopeA,
          ADMIN,
        ),
        lock(true),
      ]);

      const year = await prisma.academicYear.findUniqueOrThrow({
        where: { id: yearAId },
      });
      expect(year.isLocked).toBe(true);

      if (correction.status === 'fulfilled') {
        const rows = await prisma.enrollment.findMany({
          where: { admissionId: enrollment.admissionId },
        });
        expect(rows).toHaveLength(2);
      } else {
        expect(errorCode((correction as PromiseRejectedResult).reason)).toBe(
          'ACADEMIC_YEAR_LOCKED',
        );
      }

      await lock(false);
    });

    it('reads the lock from the server, never from the caller', async () => {
      const { enrollment } = await placed();
      await lock(true);

      await expect(
        enrollments.correctPlacement(
          enrollment.id,
          {
            academicUnitId: unitA2Id,
            reason: 'wrong class',
            // A client-supplied override has nowhere to go: no DTO carries it
            // and the service reads the row itself.
            isLocked: false,
          } as never,
          scopeA,
          ADMIN,
        ),
      ).rejects.toMatchObject({ response: { error: 'ACADEMIC_YEAR_LOCKED' } });
    });
  });

  // ---------------------------------------------------------------------------

  describe('scope', () => {
    it('hides another branch placement from every entry point', async () => {
      const { enrollment } = await placed();

      await expect(enrollments.findById(enrollment.id, scopeB)).rejects.toThrow(
        NotFoundException,
      );
      await expect(enrollments.getHistory(enrollment.id, scopeB)).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        enrollments.correctPlacement(
          enrollment.id,
          { academicUnitId: unitBId, reason: 'hijack' },
          scopeB,
          ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        enrollments.cancelEnrollment(
          enrollment.id,
          { reason: 'hijack' },
          scopeB,
          ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        enrollments.assignRollNumber(
          enrollment.id,
          { rollNumber: '1' },
          scopeB,
          ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);

      const untouched = await prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollment.id },
      });
      expect(untouched.enrollmentStatus).toBe('ACTIVE');
      expect(untouched.academicUnitId).toBe(unitA1Id);
    });

    it('hides a placement from another organization', async () => {
      const { enrollment } = await placed();

      await expect(
        enrollments.findById(enrollment.id, {
          organizationId: otherOrgId,
          branchId: branchAId,
          academicYearId: yearAId,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('answers 404 rather than 403, so a probe learns nothing', async () => {
      const { enrollment } = await placed();

      await expect(
        enrollments.findById(enrollment.id, scopeB),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('never lets a list filter reach outside the scope', async () => {
      await placed();
      const other = await placed({ branchId: branchBId });

      const result = await enrollments.search({}, scopeA);

      expect(result.items.map((e) => e.id)).not.toContain(other.enrollment.id);
      expect(result.items.every((e) => e.branchId === branchAId)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------

  describe('history and events', () => {
    it('writes one history row per side of a correction', async () => {
      const { enrollment } = await placed();

      const { current } = await enrollments.correctPlacement(
        enrollment.id,
        { academicUnitId: unitA2Id, reason: 'wrong class at admission' },
        scopeA,
        ADMIN,
      );

      const oldHistory = await prisma.workflowHistory.findMany({
        where: { entityType: 'ENROLLMENT', entityId: enrollment.id },
      });
      const newHistory = await prisma.workflowHistory.findMany({
        where: { entityType: 'ENROLLMENT', entityId: current.id },
      });

      expect(oldHistory).toHaveLength(1);
      expect(newHistory).toHaveLength(1);
      expect(oldHistory[0]).toMatchObject({
        oldStatus: 'ACTIVE',
        newStatus: 'SUPERSEDED',
        actionType: 'CORRECTION',
        remarks: 'wrong class at admission',
      });
      expect(newHistory[0]).toMatchObject({
        oldStatus: null,
        newStatus: 'ACTIVE',
        actionType: 'CORRECTION',
      });
    });

    it('carries a placement from the outbox to the audit log', async () => {
      const { enrollment } = await placed();

      const rows = await drainUntilAudited(enrollment.id, 'enrollment.created');
      expect(rows.map((r) => r.eventName)).toContain('enrollment.created');
    });

    it('does not duplicate an audit row when the relay runs twice', async () => {
      const { enrollment } = await placed();

      await drainUntilAudited(enrollment.id, 'enrollment.created');
      await moduleRef.get(OutboxRelay).drain();
      await moduleRef.get(OutboxRelay).drain();

      const rows = await prisma.auditLog.findMany({
        where: { aggregateId: enrollment.id, eventName: 'enrollment.created' },
      });
      // At-least-once delivery is only safe because `AuditLog.eventId` is
      // unique.
      expect(rows).toHaveLength(1);
    });

    it('emits both a creation and a supersession for one correction', async () => {
      const { enrollment } = await placed();

      const { current } = await enrollments.correctPlacement(
        enrollment.id,
        { academicUnitId: unitA2Id, reason: 'wrong class' },
        scopeA,
        ADMIN,
      );

      const events = await prisma.outboxEvent.findMany({
        where: { aggregateId: { in: [enrollment.id, current.id] } },
      });
      const names = events.map((e) => e.eventName);

      expect(names).toContain('enrollment.superseded');
      expect(names.filter((n) => n === 'enrollment.created')).toHaveLength(2);
    });

    it('rolls the placement back when the outbox write fails', async () => {
      const { student, admission } = await admittedStudent();

      // Spied on the publisher, not on `prisma.outboxEvent`: inside the
      // transaction the write goes through the transaction client, which a spy
      // on the global client never sees.
      const spy = jest
        .spyOn(moduleRef.get(OutboxPublisher), 'enqueue')
        .mockRejectedValueOnce(new Error('outbox unavailable'));

      await expect(
        enrollments.createInitialEnrollment({
          organizationId: orgId,
          branchId: branchAId,
          academicYearId: yearAId,
          admissionId: admission.id,
          studentId: student.id,
          programId: programAId,
          academicUnitId: unitA1Id,
        }),
      ).rejects.toThrow();

      spy.mockRestore();

      // The enrolment and its event commit together or not at all. A placement
      // that exists while its event was lost is a student nothing downstream
      // has heard of.
      const rows = await prisma.enrollment.findMany({
        where: { admissionId: admission.id },
      });
      expect(rows).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------

  describe('the current-placement probe', () => {
    it('returns at most one row per student and year', async () => {
      const { student, enrollment } = await placed();

      const current = await enrollments.findCurrent(student.id, yearAId, scopeA);
      expect(current?.id).toBe(enrollment.id);

      await enrollments.correctPlacement(
        enrollment.id,
        { academicUnitId: unitA2Id, reason: 'wrong class' },
        scopeA,
        ADMIN,
      );

      // After a correction there are two rows and still exactly one current
      // placement — which is why Student needs no `currentEnrollmentId` to keep
      // in step with every correction, transfer and promotion.
      const after = await enrollments.findCurrent(student.id, yearAId, scopeA);
      expect(after?.academicUnitId).toBe(unitA2Id);
      expect(after?.id).not.toBe(enrollment.id);
    });

    it('returns nothing once the placement is cancelled', async () => {
      const { student, enrollment } = await placed();

      await enrollments.cancelEnrollment(
        enrollment.id,
        { reason: 'void' },
        scopeA,
        ADMIN,
      );

      expect(await enrollments.findCurrent(student.id, yearAId, scopeA)).toBeNull();
    });
  });

  describe('Phase 5 compatibility', () => {
    /**
     * The exit gate for this phase: `admit()` must be able to write a Student,
     * an Admission and the first Enrollment in one transaction. If placement
     * opened its own, a later failure would leave an enrolment behind that
     * nothing points at.
     */
    it('composes inside a caller transaction and rolls back with it', async () => {
      seq += 1;
      const { personId } = await persons.resolve(orgId, {
        firstName: 'Atomic',
        lastName: `Rollback${suffix}${seq}`,
        dob: new Date('2015-04-12'),
        phone: `98${String(seq).padStart(8, '0')}`,
      });

      let studentId = '';
      let admissionId = '';

      await expect(
        prisma.$transaction(async (tx) => {
          const student = await students.createControlled(
            {
              organizationId: orgId,
              branchId: branchAId,
              personId,
              firstName: 'Atomic',
              lastName: `Rollback${suffix}${seq}`,
              dob: new Date('2015-04-12'),
              genderId,
              createdVia: 'MIGRATION',
            },
            tx,
          );
          studentId = student.id;

          const admission = await admissions.createControlled(
            {
              organizationId: orgId,
              branchId: branchAId,
              studentId: student.id,
              admissionType: 'REGULAR',
              admissionDate: new Date('2026-06-01'),
              entryProgramId: programAId,
              entryAcademicUnitId: unitA1Id,
              academicYearId: yearAId,
            },
            tx,
          );
          admissionId = admission.id;

          await enrollments.createInitialEnrollment(
            {
              organizationId: orgId,
              branchId: branchAId,
              academicYearId: yearAId,
              admissionId: admission.id,
              studentId: student.id,
              programId: programAId,
              academicUnitId: unitA1Id,
            },
            tx,
          );

          throw new Error('admit() failed after the enrolment');
        }),
      ).rejects.toThrow('admit() failed after the enrolment');

      expect(
        await prisma.enrollment.count({ where: { admissionId } }),
      ).toBe(0);
      expect(await prisma.admission.count({ where: { id: admissionId } })).toBe(0);
      expect(await prisma.student.count({ where: { id: studentId } })).toBe(0);
    });

    it('commits all three together when nothing fails', async () => {
      seq += 1;
      const { personId } = await persons.resolve(orgId, {
        firstName: 'Atomic',
        lastName: `Commit${suffix}${seq}`,
        dob: new Date('2015-04-12'),
        phone: `97${String(seq).padStart(8, '0')}`,
      });

      const result = await prisma.$transaction(async (tx) => {
        const student = await students.createControlled(
          {
            organizationId: orgId,
            branchId: branchAId,
            personId,
            firstName: 'Atomic',
            lastName: `Commit${suffix}${seq}`,
            dob: new Date('2015-04-12'),
            genderId,
            createdVia: 'MIGRATION',
          },
          tx,
        );

        const admission = await admissions.createControlled(
          {
            organizationId: orgId,
            branchId: branchAId,
            studentId: student.id,
            admissionType: 'REGULAR',
            admissionDate: new Date('2026-06-01'),
            entryProgramId: programAId,
            entryAcademicUnitId: unitA1Id,
            academicYearId: yearAId,
          },
          tx,
        );

        const enrollment = await enrollments.createInitialEnrollment(
          {
            organizationId: orgId,
            branchId: branchAId,
            academicYearId: yearAId,
            admissionId: admission.id,
            studentId: student.id,
            programId: programAId,
            academicUnitId: unitA1Id,
          },
          tx,
        );

        return { student, admission, enrollment };
      });

      expect(result.enrollment.studentId).toBe(result.student.id);
      expect(result.enrollment.admissionId).toBe(result.admission.id);
      expect(result.enrollment.originType).toBe('ADMISSION');
      expect(result.enrollment.enrollmentStatus).toBe('ACTIVE');
    });
  });

  describe('the twelve-year shape', () => {
    it('holds one person, one student, one admission and twelve thin rows', async () => {
      const { student, admission } = await admittedStudent();

      const years = [yearAId, yearA2Id];
      const units = [unitA1Id, unitNextYearId];

      for (const [i, academicYearId] of years.entries()) {
        await enrollments.createInitialEnrollment({
          organizationId: orgId,
          branchId: branchAId,
          academicYearId,
          admissionId: admission.id,
          studentId: student.id,
          programId: programAId,
          academicUnitId: units[i],
          originType: i === 0 ? 'ADMISSION' : 'PROMOTION',
        });
      }

      const rows = await prisma.enrollment.findMany({
        where: { admissionId: admission.id },
      });

      expect(rows).toHaveLength(2);
      expect(await prisma.student.count({ where: { personId: student.personId } })).toBe(1);
      expect(await prisma.admission.count({ where: { studentId: student.id } })).toBe(1);

      // The core test of the architecture: zero demographic copies. If a
      // column here ever needs a name or a date of birth, the design broke.
      const columns = Object.keys(rows[0]);
      for (const forbidden of [
        'firstName',
        'lastName',
        'dob',
        'genderId',
        'primaryMobile',
        'aadhaarNo',
        'studentCode',
        'admissionNo',
        'address',
      ]) {
        expect(columns).not.toContain(forbidden);
      }
    });
  });
});
