import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { ApplicantService } from '@/modules/admissions/applicant/applicant.service';
import { WorkflowService } from '@/modules/admissions/workflow/workflow.service';
import { WorkflowAction } from '@/modules/admissions/workflow/workflow.transitions';
import { PersonService } from '@/modules/identity/person/person.service';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { ResourceScope } from '@/common/scope/resource-scope';

/**
 * Tenant isolation and the transition race.
 *
 * These exercise two of the defects Phase 0 closed in the admissions services:
 * unscoped lookups, and a state machine that took no lock before reading state.
 * The third — an enrolment that could not outlive its applicant — moved with
 * the model to `test/integration/enrollment.integration-spec.ts` in Phase 4.
 */
describe('Admissions Phase 0 (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let applicants: ApplicantService;
  let workflow: WorkflowService;
  let numbering: NumberingService;
  let persons: PersonService;

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
    numbering = moduleRef.get(NumberingService);
    persons = moduleRef.get(PersonService);

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
            format: '{prefix}-{year}-{sequence}',
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
    // Submission puts the applicant in the identity index, so these rows exist
    // now even though nothing here creates a Person directly.
    await prisma.personSensitive.deleteMany({
      where: { person: { organizationId: orgId } },
    });
    await prisma.person.deleteMany({ where: { organizationId: orgId } });
    await prisma.organizationDataKey.deleteMany({ where: { organizationId: orgId } });
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

  /**
   * SUPER_ADMIN inherits the whole seeded catalogue without a user row, so this
   * satisfies the per-transition permission check without these tests — which
   * are about scope and locking — having to build a role and its grants.
   */
  const ADMIN = {
    userId: '00000000-0000-4000-8000-000000000001',
    role: 'SUPER_ADMIN',
  };

  async function createApplicant(
    scope: ResourceScope,
    first = 'Test',
    programId: string | undefined = scope === scopeA ? programAId : undefined,
  ) {
    const { applicant } = await applicants.create(
      {
        firstName: first,
        lastName: 'Candidate',
        dob: '2020-01-01',
        genderId,
        programId,
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

  /**
   * Put an applicant in a state directly, bypassing the state machine.
   *
   * These fixtures are about enrollment scope, not about how an application got
   * approved. Phase 3 added `applicant_person_from_submitted_check` and its
   * programme twin, so a row can no longer leave DRAFT without an identity and
   * a programme — a fixture that jumps the machine has to supply both. Each call
   * resolves its own Person, so `applicant_one_active` never fires between
   * unrelated fixtures.
   */
  async function forceStatus(applicantId: string, admissionStatus: 'APPROVED') {
    forcedPersonSeq += 1;
    const { personId } = await persons.resolve(orgId, {
      firstName: 'Forced',
      lastName: `Fixture${forcedPersonSeq}`,
      dob: new Date('2020-01-01'),
      phone: `97${String(forcedPersonSeq).padStart(8, '0')}`,
    });

    await prisma.applicant.update({
      where: { id: applicantId },
      data: { admissionStatus, personId, programId: programAId },
    });
  }
  let forcedPersonSeq = 0;

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
        workflow.transition(
          applicant.id,
          { action: WorkflowAction.SUBMIT },
          scopeB,
          ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);

      const unchanged = await prisma.applicant.findUnique({
        where: { id: applicant.id },
      });
      expect(unchanged!.admissionStatus).toBe('DRAFT');
    });
  });

  describe('workflow concurrency', () => {
    it('lets exactly one of two simultaneous transitions win', async () => {
      const applicant = await createApplicant(scopeA);

      const results = await Promise.allSettled([
        workflow.transition(
          applicant.id,
          { action: WorkflowAction.SUBMIT },
          scopeA,
          ADMIN,
        ),
        workflow.transition(
          applicant.id,
          { action: WorkflowAction.SUBMIT },
          scopeA,
          ADMIN,
        ),
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
      await workflow.transition(
        applicant.id,
        { action: WorkflowAction.SUBMIT },
        scopeA,
        ADMIN,
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
