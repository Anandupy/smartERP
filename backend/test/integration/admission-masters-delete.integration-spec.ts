import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { ApplicantService } from '@/modules/admissions/applicant/applicant.service';
import { GenderService } from '@/modules/admissions/masters/gender/gender.service';
import { DisabilityService } from '@/modules/admissions/masters/disability/disability.service';
import { RelationTypeService } from '@/modules/admissions/masters/relation-type/relation-type.service';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { ResourceScope } from '@/common/scope/resource-scope';

/**
 * R6 — Admissions Masters delete/reference-protection correctness.
 *
 * `BaseMasterService.remove()` blocks a delete with `MASTER_IN_USE` when the
 * master is genuinely referenced. Two defects existed before this suite:
 *
 * 1. The reference check never excluded soft-deleted rows on the referencing
 *    side, so a withdrawn, deleted Applicant draft kept blocking its Gender/
 *    Religion/... forever, even though it is no longer an active dependency.
 * 2. `RelationType` only checked `ApplicantGuardianMapping` ("mappings"), not
 *    the permanent, append-only `Guardianship` (Person<->Person) relation
 *    that also carries a `relationTypeId` FK — so a RelationType referenced
 *    only by a `Guardianship` row was (incorrectly) deletable.
 *
 * These are exercised against a real Postgres test database and real
 * `XxxService` instances — not mocks — because the defect lives in the exact
 * shape of the Prisma query, which a mocked `findFirst` cannot catch.
 */
describe('Admissions Masters — delete/reference protection (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let applicants: ApplicantService;
  let genders: GenderService;
  let disabilities: DisabilityService;
  let relationTypes: RelationTypeService;
  let numbering: NumberingService;

  let orgId: string;
  let otherOrgId: string;
  let branchId: string;
  let otherBranchId: string;
  let yearId: string;

  let scope: ResourceScope;
  let otherOrgScope: ResourceScope;

  const suffix = Date.now().toString();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    applicants = moduleRef.get(ApplicantService);
    genders = moduleRef.get(GenderService);
    disabilities = moduleRef.get(DisabilityService);
    relationTypes = moduleRef.get(RelationTypeService);
    numbering = moduleRef.get(NumberingService);

    const org = await prisma.organization.create({
      data: {
        name: 'R6 Org',
        code: 'R6ORG_' + suffix,
        contactEmail: 'r6@test.local',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    orgId = org.id;

    const otherOrg = await prisma.organization.create({
      data: {
        name: 'R6 Other Org',
        code: 'R6ORG2_' + suffix,
        contactEmail: 'r6b@test.local',
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

    const branch = await prisma.branch.create({
      data: {
        organizationId: orgId,
        name: 'R6 Branch',
        code: 'R6B_' + suffix,
        ...branchDefaults,
      },
    });
    branchId = branch.id;

    const otherBranch = await prisma.branch.create({
      data: {
        organizationId: otherOrgId,
        name: 'R6 Other Branch',
        code: 'R6B2_' + suffix,
        ...branchDefaults,
      },
    });
    otherBranchId = otherBranch.id;

    const year = await prisma.academicYear.create({
      data: {
        branchId,
        name: '2026-27',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
      },
    });
    yearId = year.id;

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

    scope = { organizationId: orgId, branchId, academicYearId: yearId };
    otherOrgScope = {
      organizationId: otherOrgId,
      branchId: otherBranchId,
      academicYearId: null,
    };
  });

  afterAll(async () => {
    await prisma.guardianship.deleteMany({ where: { organizationId: orgId } });
    await prisma.applicantGuardianMapping.deleteMany({
      where: { applicant: { organizationId: orgId } },
    });
    await prisma.guardian.deleteMany({ where: { organizationId: orgId } });
    await prisma.person.deleteMany({ where: { organizationId: orgId } });
    await prisma.applicant.deleteMany({ where: { organizationId: orgId } });
    await prisma.relationType.deleteMany({ where: { organizationId: orgId } });
    await prisma.disability.deleteMany({ where: { organizationId: orgId } });
    await prisma.gender.deleteMany({
      where: { organizationId: { in: [orgId, otherOrgId] } },
    });
    await prisma.numberSequenceCounter.deleteMany({
      where: { config: { organizationId: orgId } },
    });
    await prisma.numberSequenceConfig.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.academicYear.deleteMany({ where: { branchId } });
    await prisma.branch.deleteMany({
      where: { id: { in: [branchId, otherBranchId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgId, otherOrgId] } },
    });
    await moduleRef.close();
  });

  async function createGender(name: string, targetScope = scope) {
    return prisma.gender.create({
      data: {
        organizationId: targetScope.organizationId,
        branchId: targetScope.branchId,
        code: name.toUpperCase().slice(0, 8) + suffix.slice(-4),
        name: name + suffix,
      },
    });
  }

  async function createApplicant(genderId: string) {
    const { applicant } = await applicants.create(
      {
        firstName: 'Test',
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

  describe('an unreferenced master', () => {
    it('deletes successfully', async () => {
      const gender = await createGender('Unused');

      const deleted = await genders.remove(gender.id, scope);

      expect(deleted.deletedAt).not.toBeNull();
    });
  });

  describe('a master referenced by an active Applicant', () => {
    it('is blocked with MASTER_IN_USE', async () => {
      const gender = await createGender('InUse');
      await createApplicant(gender.id);

      const error: ConflictException = await genders
        .remove(gender.id, scope)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ error: 'MASTER_IN_USE' });
    });
  });

  describe('a master referenced only by a soft-deleted Applicant', () => {
    it('is deletable — a deleted draft is no longer an active dependency', async () => {
      const gender = await createGender('WithdrawnRef');
      const applicant = await createApplicant(gender.id);

      // DRAFT is not a frozen status, so Applicant.remove() may soft-delete it.
      await applicants.remove(applicant.id, scope);

      const deleted = await genders.remove(gender.id, scope);

      expect(deleted.deletedAt).not.toBeNull();
    });
  });

  describe('cross-organization isolation', () => {
    it('an Applicant in one organization never blocks deletion of a same-named Gender in another', async () => {
      const genderOrgA = await createGender('Shared', scope);
      const genderOrgB = await createGender('Shared', otherOrgScope);
      await createApplicant(genderOrgA.id);

      // Org A's row is genuinely referenced.
      await expect(genders.remove(genderOrgA.id, scope)).rejects.toThrow(
        ConflictException,
      );

      // Org B's identically-named, unreferenced row is unaffected.
      const deleted = await genders.remove(genderOrgB.id, otherOrgScope);
      expect(deleted.deletedAt).not.toBeNull();
    });
  });

  describe('Disability — same generic check, a different master', () => {
    it('unused deletes, in-use is blocked', async () => {
      const unused = await prisma.disability.create({
        data: {
          organizationId: orgId,
          branchId,
          code: 'DIS_U_' + suffix.slice(-6),
          name: 'Unused Disability ' + suffix,
        },
      });
      const deletedUnused = await disabilities.remove(unused.id, scope);
      expect(deletedUnused.deletedAt).not.toBeNull();

      const inUse = await prisma.disability.create({
        data: {
          organizationId: orgId,
          branchId,
          code: 'DIS_IU_' + suffix.slice(-5),
          name: 'InUse Disability ' + suffix,
        },
      });
      const gender = await createGender('DisabilityFixtureGender');
      await applicants.create(
        {
          firstName: 'Test',
          lastName: 'Candidate',
          dob: '2020-01-01',
          genderId: gender.id,
          disabilityTypeId: inUse.id,
          primaryMobile: '99887' + Math.floor(10000 + Math.random() * 89999),
          currentAddressLine1: 'Road 1',
          city: 'Mumbai',
          state: 'MH',
          country: 'IN',
          pincode: '400001',
        } as any,
        scope,
      );

      const error: ConflictException = await disabilities
        .remove(inUse.id, scope)
        .catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ error: 'MASTER_IN_USE' });
    });
  });

  describe('RelationType — referenced only through Guardianship, not ApplicantGuardianMapping', () => {
    it('is blocked, closing the gap where only "mappings" was checked', async () => {
      const relationType = await prisma.relationType.create({
        data: {
          organizationId: orgId,
          branchId,
          code: 'RT_GS_' + suffix.slice(-5),
          name: 'GuardianshipOnly ' + suffix,
        },
      });

      const guardianPerson = await prisma.person.create({
        data: {
          organizationId: orgId,
          dob: new Date('1985-01-01'),
          nameNormalized: 'guardian person ' + suffix,
        },
      });
      const wardPerson = await prisma.person.create({
        data: {
          organizationId: orgId,
          dob: new Date('2020-01-01'),
          nameNormalized: 'ward person ' + suffix,
        },
      });
      await prisma.guardianship.create({
        data: {
          organizationId: orgId,
          guardianPersonId: guardianPerson.id,
          wardPersonId: wardPerson.id,
          relationTypeId: relationType.id,
        },
      });

      const error: ConflictException = await relationTypes
        .remove(relationType.id, scope)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ error: 'MASTER_IN_USE' });
    });

    it('an unreferenced RelationType still deletes', async () => {
      const relationType = await prisma.relationType.create({
        data: {
          organizationId: orgId,
          branchId,
          code: 'RT_U_' + suffix.slice(-6),
          name: 'UnusedRelation ' + suffix,
        },
      });

      const deleted = await relationTypes.remove(relationType.id, scope);

      expect(deleted.deletedAt).not.toBeNull();
    });
  });
});
