import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { ApplicantService } from '@/modules/admissions/applicant/applicant.service';
import { WorkflowService } from '@/modules/admissions/workflow/workflow.service';
import { EnrollmentService } from '@/modules/admissions/enrollment/enrollment.service';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { ResourceScope } from '@/common/scope/resource-scope';

/**
 * Tenant isolation, academic history durability, and the transition race.
 *
 * These exercise the three defects Phase 0 closes in the admissions services:
 * unscoped lookups, an enrollment that could not outlive its applicant, and a
 * state machine that took no lock before reading state.
 */
describe('Admissions Phase 0 (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let applicants: ApplicantService;
  let workflow: WorkflowService;
  let enrollment: EnrollmentService;
  let numbering: NumberingService;

  let orgId: string;
  let otherOrgId: string;
  let branchAId: string;
  let branchBId: string;
  let yearAId: string;
  let programAId: string;
  let unitAId: string;
  let genderId: string;

  let scopeA: ResourceScope;
  let scopeB: ResourceScope;

  const suffix = Date.now().toString();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    applicants = moduleRef.get(ApplicantService);
    workflow = moduleRef.get(WorkflowService);
    enrollment = moduleRef.get(EnrollmentService);
    numbering = moduleRef.get(NumberingService);

    const org = await prisma.organization.create({
      data: {
        name: 'Phase0 Org',
        code: 'P0ORG_' + suffix,
        contactEmail: 'p0@test.local',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    orgId = org.id;

    const otherOrg = await prisma.organization.create({
      data: {
        name: 'Phase0 Other Org',
        code: 'P0ORG2_' + suffix,
        contactEmail: 'p0b@test.local',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    otherOrgId = otherOrg.id;

    const branchDefaults = {
      institutionType: 'SCHOOL' as const,
      contactEmail: 'b@test.local',
      contactPhone: '1234567890',
      addressLine1: 'Road 1',
      city: 'Mumbai',
      state: 'MH',
      country: 'IN',
      pincode: '400001',
    };

    const branchA = await prisma.branch.create({
      data: { organizationId: orgId, name: 'Branch A', code: 'P0A_' + suffix, ...branchDefaults },
    });
    branchAId = branchA.id;

    const branchB = await prisma.branch.create({
      data: { organizationId: orgId, name: 'Branch B', code: 'P0B_' + suffix, ...branchDefaults },
    });
    branchBId = branchB.id;

    const yearA = await prisma.academicYear.create({
      data: {
        branchId: branchAId,
        name: '2026-27',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
      },
    });
    yearAId = yearA.id;

    const yearB = await prisma.academicYear.create({
      data: {
        branchId: branchBId,
        name: '2026-27',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
      },
    });

    const programA = await prisma.program.create({
      data: { branchId: branchAId, name: 'Std 1 ' + suffix },
    });
    programAId = programA.id;

    const unitA = await prisma.academicUnit.create({
      data: {
        branchId: branchAId,
        programId: programAId,
        academicYearId: yearAId,
        name: 'Std 1-A',
        unitType: 'SECTION',
        level: 1,
      },
    });
    unitAId = unitA.id;

    const gender = await prisma.gender.create({
      data: { organizationId: orgId, code: 'P0G_' + suffix, name: 'Gender ' + suffix },
    });
    genderId = gender.id;

    for (const branchId of [branchAId, branchBId]) {
      for (const purpose of ['ADMISSION_FORM', 'APPLICATION'] as const) {
        await numbering.createConfig(
          {
            purpose,
            prefix: purpose === 'ADMISSION_FORM' ? 'ADM' : 'APP',
            sequencePadding: 4,
            format: '{prefix}-{sequence}',
          },
          orgId,
          branchId,
        );
      }
    }

    scopeA = { organizationId: orgId, branchId: branchAId, academicYearId: yearAId };
    scopeB = { organizationId: orgId, branchId: branchBId, academicYearId: yearB.id };
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.enrollment.deleteMany({ where: { organizationId: orgId } });
    await prisma.workflowHistory.deleteMany({ where: { organizationId: orgId } });
    await prisma.applicant.deleteMany({ where: { organizationId: orgId } });
    await prisma.numberSequenceCounter.deleteMany({
      where: { config: { organizationId: orgId } },
    });
    await prisma.numberSequenceConfig.deleteMany({ where: { organizationId: orgId } });
    await prisma.academicUnit.deleteMany({ where: { branchId: { in: [branchAId, branchBId] } } });
    await prisma.program.deleteMany({ where: { branchId: { in: [branchAId, branchBId] } } });
    await prisma.academicYear.deleteMany({ where: { branchId: { in: [branchAId, branchBId] } } });
    await prisma.gender.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
    await moduleRef.close();
  });

  async function createApplicant(scope: ResourceScope, first = 'Test') {
    const { applicant } = await applicants.create(
      {
        firstName: first,
        lastName: 'Candidate',
        dob: '2020-01-01',
        genderId,
        primaryMobile: '99887' + Math.floor(10000 + Math.random() * 89999),
        currentAddressLine1: 'Road 1',
        city: 'Mumbai',
        state: 'MH',
        country: 'IN',
        pincode: '400001',
      } as any,
      scope,
    );
    return applicant;
  }

  describe('tenant isolation', () => {
    it('hides another branch applicant from a read', async () => {
      const applicant = await createApplicant(scopeA);

      await expect(applicants.findOne(applicant.id, scopeB)).rejects.toThrow(
        NotFoundException,
      );
      await expect(applicants.findOne(applicant.id, scopeA)).resolves.toMatchObject(
        { id: applicant.id },
      );
    });

    it('refuses a cross-branch update', async () => {
      const applicant = await createApplicant(scopeA);

      await expect(
        applicants.update(applicant.id, { firstName: 'Hijacked' } as any, scopeB),
      ).rejects.toThrow(NotFoundException);

      const unchanged = await prisma.applicant.findUnique({
        where: { id: applicant.id },
      });
      expect(unchanged!.firstName).not.toBe('Hijacked');
    });

    it('refuses a cross-branch soft delete', async () => {
      const applicant = await createApplicant(scopeA);

      await expect(applicants.remove(applicant.id, scopeB)).rejects.toThrow(
        NotFoundException,
      );

      const unchanged = await prisma.applicant.findUnique({
        where: { id: applicant.id },
      });
      expect(unchanged!.deletedAt).toBeNull();
    });

    it('refuses a cross-branch workflow transition', async () => {
      const applicant = await createApplicant(scopeA);

      await expect(
        workflow.transitionState(applicant.id, { newStatus: 'SUBMITTED' } as any, scopeB),
      ).rejects.toThrow(NotFoundException);

      const unchanged = await prisma.applicant.findUnique({
        where: { id: applicant.id },
      });
      expect(unchanged!.admissionStatus).toBe('DRAFT');
    });

    /**
     * The most serious of the seven vectors. The applicant was fetched by id
     * with no scope check, and the enrollment was then written with the
     * *caller's* organization, branch and year — fabricating a placement in a
     * branch the applicant had never applied to.
     */
    it('refuses to enroll another branch applicant into the caller branch', async () => {
      const applicant = await createApplicant(scopeA);

      await prisma.applicant.update({
        where: { id: applicant.id },
        data: { admissionStatus: 'APPROVED' },
      });

      await expect(
        enrollment.createEnrollment(
          applicant.id,
          { programId: programAId, academicUnitId: unitAId } as any,
          scopeB,
        ),
      ).rejects.toThrow(NotFoundException);

      const rows = await prisma.enrollment.findMany({
        where: { applicantId: applicant.id },
      });
      expect(rows).toHaveLength(0);
    });

    it('hides another branch enrollment from a read', async () => {
      const applicant = await createApplicant(scopeA);
      await prisma.applicant.update({
        where: { id: applicant.id },
        data: { admissionStatus: 'APPROVED' },
      });
      await enrollment.createEnrollment(
        applicant.id,
        { programId: programAId, academicUnitId: unitAId } as any,
        scopeA,
      );

      await expect(
        enrollment.getEnrollment(applicant.id, scopeB),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('academic history durability', () => {
    it('lets one applicant hold enrollments in more than one year', async () => {
      const applicant = await createApplicant(scopeA);

      const yearTwo = await prisma.academicYear.create({
        data: {
          branchId: branchAId,
          name: '2027-28 ' + suffix,
          startDate: new Date('2027-04-01'),
          endDate: new Date('2028-03-31'),
        },
      });

      // The unique constraint on applicantId made this impossible, which is
      // what made promotion unrepresentable.
      await prisma.enrollment.create({
        data: {
          organizationId: orgId,
          branchId: branchAId,
          academicYearId: yearAId,
          programId: programAId,
          academicUnitId: unitAId,
          applicantId: applicant.id,
          enrollmentStatus: 'PROMOTED',
        },
      });

      const unitTwo = await prisma.academicUnit.create({
        data: {
          branchId: branchAId,
          programId: programAId,
          academicYearId: yearTwo.id,
          name: 'Std 2-A',
          unitType: 'SECTION',
          level: 1,
        },
      });

      await prisma.enrollment.create({
        data: {
          organizationId: orgId,
          branchId: branchAId,
          academicYearId: yearTwo.id,
          programId: programAId,
          academicUnitId: unitTwo.id,
          applicantId: applicant.id,
          enrollmentStatus: 'ACTIVE',
        },
      });

      const rows = await prisma.enrollment.findMany({
        where: { applicantId: applicant.id },
      });
      expect(rows).toHaveLength(2);
    });

    it('keeps the enrollment when the applicant row is deleted', async () => {
      const applicant = await createApplicant(scopeA);

      const created = await prisma.enrollment.create({
        data: {
          organizationId: orgId,
          branchId: branchAId,
          academicYearId: yearAId,
          programId: programAId,
          academicUnitId: unitAId,
          applicantId: applicant.id,
          enrollmentStatus: 'ACTIVE',
        },
      });

      await prisma.workflowHistory.deleteMany({
        where: { entityType: 'APPLICANT', entityId: applicant.id },
      });
      await prisma.applicant.delete({ where: { id: applicant.id } });

      // The cascade previously destroyed the academic record along with the
      // application it happened to originate from.
      const survivor = await prisma.enrollment.findUnique({
        where: { id: created.id },
      });
      expect(survivor).not.toBeNull();
      expect(survivor!.applicantId).toBeNull();
    });
  });

  describe('workflow concurrency', () => {
    it('lets exactly one of two simultaneous transitions win', async () => {
      const applicant = await createApplicant(scopeA);

      const results = await Promise.allSettled([
        workflow.transitionState(applicant.id, { newStatus: 'SUBMITTED' } as any, scopeA),
        workflow.transitionState(applicant.id, { newStatus: 'SUBMITTED' } as any, scopeA),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Without SELECT ... FOR UPDATE both read DRAFT and both pass the guard.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const history = await prisma.workflowHistory.findMany({
        where: { entityType: 'APPLICANT', entityId: applicant.id },
      });
      expect(history).toHaveLength(1);
    });

    it('records history against the polymorphic key', async () => {
      const applicant = await createApplicant(scopeA);
      await workflow.transitionState(
        applicant.id,
        { newStatus: 'SUBMITTED', actionType: 'SUBMIT' } as any,
        scopeA,
      );

      const history = await workflow.getHistory(applicant.id, scopeA);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        entityType: 'APPLICANT',
        entityId: applicant.id,
        organizationId: orgId,
        branchId: branchAId,
        oldStatus: 'DRAFT',
        newStatus: 'SUBMITTED',
      });
    });
  });

  describe('academic structure validation', () => {
    it('refuses an academic unit from another branch', async () => {
      const applicant = await createApplicant(scopeA);
      await prisma.applicant.update({
        where: { id: applicant.id },
        data: { admissionStatus: 'APPROVED' },
      });

      const programB = await prisma.program.create({
        data: { branchId: branchBId, name: 'Std 1 B ' + suffix },
      });
      const yearB = await prisma.academicYear.findFirstOrThrow({
        where: { branchId: branchBId },
      });
      const unitB = await prisma.academicUnit.create({
        data: {
          branchId: branchBId,
          programId: programB.id,
          academicYearId: yearB.id,
          name: 'Std 1-B',
          unitType: 'SECTION',
          level: 1,
        },
      });

      await expect(
        enrollment.createEnrollment(
          applicant.id,
          { programId: programB.id, academicUnitId: unitB.id } as any,
          scopeA,
        ),
      ).rejects.toMatchObject({ response: { error: 'ACADEMIC_UNIT_MISMATCH' } });
    });

    it('refuses a write into a locked academic year', async () => {
      const applicant = await createApplicant(scopeA);
      await prisma.applicant.update({
        where: { id: applicant.id },
        data: { admissionStatus: 'APPROVED' },
      });
      await prisma.academicYear.update({
        where: { id: yearAId },
        data: { isLocked: true },
      });

      try {
        await expect(
          enrollment.createEnrollment(
            applicant.id,
            { programId: programAId, academicUnitId: unitAId } as any,
            scopeA,
          ),
        ).rejects.toMatchObject({ response: { error: 'ACADEMIC_YEAR_LOCKED' } });
      } finally {
        await prisma.academicYear.update({
          where: { id: yearAId },
          data: { isLocked: false },
        });
      }
    });
  });

  describe('applicant status is an enum at the database', () => {
    it('rejects a status the workflow engine could never produce', async () => {
      const applicant = await createApplicant(scopeA);

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "Applicant" SET "admissionStatus" = 'aproved' WHERE "id" = $1`,
          applicant.id,
        ),
      ).rejects.toThrow();
    });
  });
});
