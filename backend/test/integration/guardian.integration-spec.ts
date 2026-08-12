import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { GuardiansService } from '@/modules/admissions/guardians/guardians.service';
import { ResourceScope } from '@/common/scope/resource-scope';

/**
 * R2 — guardian tenant scoping.
 *
 * Before this change, every guardian lookup was `findFirst({ id })` with no
 * organization or branch in the `WHERE`: any authenticated user of any
 * tenant could read, update, map or unmap any guardian by UUID. These tests
 * run against real Postgres so they prove isolation the database actually
 * enforces, not an assertion against a mock that cannot be wrong.
 */
describe('Guardian tenant scoping (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let guardians: GuardiansService;

  const suffix = Date.now().toString();

  let orgA: string;
  let orgB: string;
  let branchA: string;
  let branchB: string;
  let scopeA: ResourceScope;
  let scopeB: ResourceScope;
  let applicantA: string;
  let applicantB: string;
  let relationTypeId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    guardians = moduleRef.get(GuardiansService);

    const makeOrg = async (label: string) =>
      (
        await prisma.organization.create({
          data: {
            name: `Guardian Test ${label}`,
            code: `GT${label}_${suffix}`,
            contactEmail: 'g@test.local',
            contactPhone: '1234567890',
            masterExpiryDate: new Date(Date.now() + 8.64e7),
          },
        })
      ).id;

    const makeBranch = async (organizationId: string, label: string) =>
      (
        await prisma.branch.create({
          data: {
            organizationId,
            name: `Branch ${label}`,
            code: `GB${label}_${suffix}`,
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

    orgA = await makeOrg('A');
    orgB = await makeOrg('B');
    branchA = await makeBranch(orgA, 'A');
    branchB = await makeBranch(orgB, 'B');

    scopeA = { organizationId: orgA, branchId: branchA, academicYearId: null };
    scopeB = { organizationId: orgB, branchId: branchB, academicYearId: null };

    const makeYear = async (branchId: string) =>
      (
        await prisma.academicYear.create({
          data: {
            branchId,
            name: '2026-27',
            startDate: new Date('2026-04-01'),
            endDate: new Date('2027-03-31'),
          },
        })
      ).id;

    const yearA = await makeYear(branchA);
    const yearB = await makeYear(branchB);

    const makeGender = async (organizationId: string, label: string) =>
      (
        await prisma.gender.create({
          data: {
            organizationId,
            code: `GG${label}_${suffix}`,
            name: `Gender ${label}`,
          },
        })
      ).id;

    const genderA = await makeGender(orgA, 'A');
    const genderB = await makeGender(orgB, 'B');

    const makeApplicant = async (
      organizationId: string,
      branchId: string,
      academicYearId: string,
      genderId: string,
      label: string,
    ) =>
      (
        await prisma.applicant.create({
          data: {
            organizationId,
            branchId,
            academicYearId,
            admissionFormNo: `AF-${label}-${suffix}`,
            applicationNo: `AP-${label}-${suffix}`,
            firstName: 'Applicant',
            lastName: label,
            displayName: `Applicant ${label}`,
            dob: new Date('2018-01-01'),
            genderId,
            primaryMobile:
              '9' + Math.floor(100000000 + Math.random() * 899999999),
            currentAddressLine1: 'Road 1',
            city: 'Mumbai',
            state: 'MH',
            country: 'IN',
            pincode: '400001',
            admissionStatus: 'DRAFT',
          },
        })
      ).id;

    applicantA = await makeApplicant(orgA, branchA, yearA, genderA, 'A');
    applicantB = await makeApplicant(orgB, branchB, yearB, genderB, 'B');

    relationTypeId = (
      await prisma.relationType.create({
        data: {
          code: `REL_${suffix}`,
          name: `Father ${suffix}`,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.applicantGuardianMapping.deleteMany({
      where: { applicantId: { in: [applicantA, applicantB] } },
    });
    await prisma.guardian.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.relationType.deleteMany({ where: { id: relationTypeId } });
    await prisma.applicant.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.academicYear.deleteMany({
      where: { branchId: { in: [branchA, branchB] } },
    });
    await prisma.gender.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.branch.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgA, orgB] } },
    });
    await moduleRef.close();
  });

  async function makeGuardian(scope: ResourceScope, lastName: string) {
    return guardians.create(
      {
        firstName: 'Guardian',
        lastName,
        mobilePrimary: '9' + Math.floor(100000000 + Math.random() * 899999999),
      } as any,
      scope,
    );
  }

  describe('read', () => {
    it('A — a same-tenant authorized read succeeds', async () => {
      const guardian = await makeGuardian(scopeA, 'SameTenant');
      const found = await guardians.findOne(guardian.id, scopeA);
      expect(found.id).toBe(guardian.id);
    });

    it('B — a cross-tenant read returns 404, not the other tenant’s record', async () => {
      const guardian = await makeGuardian(scopeA, 'CrossRead');
      await expect(guardians.findOne(guardian.id, scopeB)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('D — a missing guardian returns 404', async () => {
      await expect(
        guardians.findOne('00000000-0000-4000-8000-000000000099', scopeA),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not surface another tenant’s guardian through search', async () => {
      const marker = `Uniq${suffix}`;
      const guardian = await makeGuardian(scopeA, marker);
      const resultsInB = await guardians.search(marker, scopeB);
      expect(resultsInB.find((g) => g.id === guardian.id)).toBeUndefined();

      const resultsInA = await guardians.search(marker, scopeA);
      expect(resultsInA.find((g) => g.id === guardian.id)).toBeDefined();
    });
  });

  describe('write', () => {
    it('C — a cross-tenant mutation returns 404 and does not mutate the row', async () => {
      const guardian = await makeGuardian(scopeA, 'CrossWrite');

      await expect(
        guardians.update(guardian.id, { firstName: 'Hacked' } as any, scopeB),
      ).rejects.toThrow(NotFoundException);

      const stillIntact = await prisma.guardian.findUnique({
        where: { id: guardian.id },
      });
      expect(stillIntact?.firstName).toBe('Guardian');
    });

    it('a same-tenant authorized update succeeds', async () => {
      const guardian = await makeGuardian(scopeA, 'SameWrite');
      const updated = await guardians.update(
        guardian.id,
        { firstName: 'Updated' } as any,
        scopeA,
      );
      expect(updated.firstName).toBe('Updated');
    });
  });

  describe('applicant mapping', () => {
    it('maps a same-tenant guardian to a same-tenant applicant', async () => {
      const guardian = await makeGuardian(scopeA, 'MapSame');

      const mapping = await guardians.mapGuardianToApplicant(
        applicantA,
        { guardianId: guardian.id, relationTypeId } as any,
        scopeA,
      );
      expect(mapping.guardianId).toBe(guardian.id);

      const mapped = await guardians.getMappedGuardians(applicantA, scopeA);
      expect(mapped.some((m) => m.guardianId === guardian.id)).toBe(true);
    });

    it('refuses to map another tenant’s guardian onto an in-scope applicant (404)', async () => {
      const guardianB = await makeGuardian(scopeB, 'OtherTenantGuardian');

      await expect(
        guardians.mapGuardianToApplicant(
          applicantA,
          { guardianId: guardianB.id, relationTypeId } as any,
          scopeA,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses to map an in-scope guardian onto another tenant’s applicant (404)', async () => {
      const guardian = await makeGuardian(scopeA, 'MapCrossApplicant');

      await expect(
        guardians.mapGuardianToApplicant(
          applicantB,
          { guardianId: guardian.id, relationTypeId } as any,
          scopeB,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('hides another tenant’s applicant mapping list behind 404', async () => {
      await expect(
        guardians.getMappedGuardians(applicantA, scopeB),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses a cross-tenant unmap and leaves the mapping untouched', async () => {
      const guardian = await makeGuardian(scopeA, 'UnmapSame');
      await guardians.mapGuardianToApplicant(
        applicantA,
        { guardianId: guardian.id, relationTypeId } as any,
        scopeA,
      );

      await expect(
        guardians.removeMapping(applicantA, guardian.id, scopeB),
      ).rejects.toThrow(NotFoundException);

      const stillMapped = await prisma.applicantGuardianMapping.findUnique({
        where: {
          applicantId_guardianId: {
            applicantId: applicantA,
            guardianId: guardian.id,
          },
        },
      });
      expect(stillMapped).not.toBeNull();
    });

    it('removes a same-tenant mapping', async () => {
      const guardian = await makeGuardian(scopeA, 'UnmapAllowed');
      await guardians.mapGuardianToApplicant(
        applicantA,
        { guardianId: guardian.id, relationTypeId } as any,
        scopeA,
      );

      await guardians.removeMapping(applicantA, guardian.id, scopeA);

      const gone = await prisma.applicantGuardianMapping.findUnique({
        where: {
          applicantId_guardianId: {
            applicantId: applicantA,
            guardianId: guardian.id,
          },
        },
      });
      expect(gone).toBeNull();
    });
  });
});
