import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { GuardiansService } from '@/modules/admissions/guardians/guardians.service';
import { GuardianshipService } from '@/modules/admissions/guardians/guardianship.service';
import {
  ResourceScope,
  OrganizationScope,
} from '@/common/scope/resource-scope';

/**
 * R4.5 — Guardian -> Person -> Guardianship, real-DB invariants.
 *
 * The exclusivity and concurrency cases run against real Postgres: the
 * partial unique indexes added in `20260816000000_r4_5_...` are the actual
 * guarantee (§8.4 Defects 1/2), and only a real constraint violation proves
 * they exist. The full `admit()` wiring (that `syncFromApplicantMappings` is
 * actually called) is covered at the unit level
 * (`admission-conversion.service.spec.ts`) via a mock; this file proves what
 * that call does once it reaches the database.
 */
describe('Guardian / Guardianship (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let guardians: GuardiansService;
  let guardianships: GuardianshipService;

  const suffix = Date.now().toString();
  let orgA: string;
  let orgB: string;
  let branchA: string;
  let academicYearA: string;
  let scopeA: ResourceScope;
  let orgScopeA: OrganizationScope;
  let orgScopeB: OrganizationScope;
  let relationTypeId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    guardians = moduleRef.get(GuardiansService);
    guardianships = moduleRef.get(GuardianshipService);

    const makeOrg = async (label: string) =>
      (
        await prisma.organization.create({
          data: {
            name: `Guardianship Test ${label}`,
            code: `GS${label}_${suffix}`,
            contactEmail: 'gs@test.local',
            contactPhone: '1234567890',
            masterExpiryDate: new Date(Date.now() + 8.64e7),
          },
        })
      ).id;

    orgA = await makeOrg('A');
    orgB = await makeOrg('B');
    orgScopeA = { organizationId: orgA };
    orgScopeB = { organizationId: orgB };

    branchA = (
      await prisma.branch.create({
        data: {
          organizationId: orgA,
          name: 'Branch A',
          code: `GSB_${suffix}`,
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

    academicYearA = (
      await prisma.academicYear.create({
        data: {
          branchId: branchA,
          name: '2026-27',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2027-03-31'),
        },
      })
    ).id;

    scopeA = {
      organizationId: orgA,
      branchId: branchA,
      academicYearId: academicYearA,
    };

    relationTypeId = (
      await prisma.relationType.create({
        data: { code: `GSREL_${suffix}`, name: `Father GS ${suffix}` },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.guardianship.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.applicantGuardianMapping.deleteMany({
      where: { guardian: { organizationId: { in: [orgA, orgB] } } },
    });
    await prisma.guardian.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.applicant.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.person.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.relationType.deleteMany({ where: { id: relationTypeId } });
    await prisma.academicYear.deleteMany({ where: { id: academicYearA } });
    await prisma.branch.deleteMany({ where: { id: branchA } });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgA, orgB] } },
    });
    await moduleRef.close();
  });

  const uniqueMobile = () =>
    '9' + Math.floor(100000000 + Math.random() * 899999999);

  const makePerson = async (org: string, label: string) =>
    (
      await prisma.person.create({
        data: {
          organizationId: org,
          dob: new Date('1980-01-01'),
          nameNormalized: `ward ${label} ${Math.random()}`,
        },
      })
    ).id;

  describe('Guardian -> Person resolution', () => {
    it('leaves personId null when no dob is supplied — the pre-existing behaviour', async () => {
      const guardian = await guardians.create(
        {
          firstName: 'No',
          lastName: 'Dob',
          mobilePrimary: uniqueMobile(),
        } as any,
        scopeA,
      );
      expect(guardian.personId).toBeNull();
    });

    it('resolves a Person when dob is supplied at create', async () => {
      const guardian = await guardians.create(
        {
          firstName: 'Has',
          lastName: 'Dob',
          mobilePrimary: uniqueMobile(),
          dob: '1985-06-15',
        } as any,
        scopeA,
      );
      expect(guardian.personId).not.toBeNull();

      const person = await prisma.person.findUnique({
        where: { id: guardian.personId! },
      });
      expect(person?.organizationId).toBe(orgA);
    });

    it('links a Person retroactively when dob is supplied at update on an unlinked guardian', async () => {
      const guardian = await guardians.create(
        {
          firstName: 'Later',
          lastName: 'Link',
          mobilePrimary: uniqueMobile(),
        } as any,
        scopeA,
      );
      expect(guardian.personId).toBeNull();

      const updated = await guardians.update(
        guardian.id,
        { dob: '1990-03-20' } as any,
        scopeA,
      );
      expect(updated.personId).not.toBeNull();
    });

    it('ignores dob on update when the guardian already has a personId', async () => {
      const guardian = await guardians.create(
        {
          firstName: 'Already',
          lastName: 'Linked',
          mobilePrimary: uniqueMobile(),
          dob: '1975-11-11',
        } as any,
        scopeA,
      );
      const originalPersonId = guardian.personId;

      const updated = await guardians.update(
        guardian.id,
        { dob: '2000-01-01' } as any,
        scopeA,
      );
      expect(updated.personId).toBe(originalPersonId);
    });
  });

  describe('mapGuardianToApplicant syncs Guardianship when both sides are resolved', () => {
    it('creates a Guardianship once both applicant and guardian have a personId', async () => {
      const wardPersonId = await makePerson(orgA, 'sync1');
      const applicant = await prisma.applicant.create({
        data: {
          organizationId: orgA,
          branchId: branchA,
          academicYearId: academicYearA,
          admissionFormNo: `AF-SYNC1-${suffix}`,
          applicationNo: `AP-SYNC1-${suffix}`,
          firstName: 'Ward',
          lastName: 'One',
          displayName: 'Ward One',
          dob: new Date('2018-01-01'),
          genderId: (
            await prisma.gender.create({
              data: {
                organizationId: orgA,
                code: `GSG1_${suffix}`,
                name: 'G1',
              },
            })
          ).id,
          primaryMobile: uniqueMobile(),
          currentAddressLine1: 'Road 1',
          city: 'Mumbai',
          state: 'MH',
          country: 'IN',
          pincode: '400001',
          admissionStatus: 'DRAFT',
          personId: wardPersonId,
        },
      });

      const guardian = await guardians.create(
        {
          firstName: 'Synced',
          lastName: 'Guardian',
          mobilePrimary: uniqueMobile(),
          dob: '1982-02-02',
        } as any,
        scopeA,
      );

      await guardians.mapGuardianToApplicant(
        applicant.id,
        { guardianId: guardian.id, relationTypeId, isPrimary: true } as any,
        scopeA,
      );

      const active = await guardianships.findByWard(wardPersonId, orgScopeA);
      expect(active).toHaveLength(1);
      expect(active[0].guardianPersonId).toBe(guardian.personId);
      expect(active[0].isPrimary).toBe(true);
    });

    it('does not create a Guardianship when the applicant has no personId yet', async () => {
      const applicant = await prisma.applicant.create({
        data: {
          organizationId: orgA,
          branchId: branchA,
          academicYearId: academicYearA,
          admissionFormNo: `AF-NOSYNC-${suffix}`,
          applicationNo: `AP-NOSYNC-${suffix}`,
          firstName: 'Draft',
          lastName: 'Ward',
          displayName: 'Draft Ward',
          dob: new Date('2018-01-01'),
          genderId: (
            await prisma.gender.create({
              data: {
                organizationId: orgA,
                code: `GSG2_${suffix}`,
                name: 'G2',
              },
            })
          ).id,
          primaryMobile: uniqueMobile(),
          currentAddressLine1: 'Road 1',
          city: 'Mumbai',
          state: 'MH',
          country: 'IN',
          pincode: '400001',
          admissionStatus: 'DRAFT',
        },
      });
      const guardian = await guardians.create(
        {
          firstName: 'Unsynced',
          lastName: 'Guardian',
          mobilePrimary: uniqueMobile(),
          dob: '1983-03-03',
        } as any,
        scopeA,
      );

      await guardians.mapGuardianToApplicant(
        applicant.id,
        { guardianId: guardian.id, relationTypeId } as any,
        scopeA,
      );

      const count = await prisma.guardianship.count({
        where: { guardianPersonId: guardian.personId! },
      });
      expect(count).toBe(0);
    });
  });

  describe('database invariants', () => {
    it('rejects a self-guardianship at the database level', async () => {
      const p = await makePerson(orgA, 'self');

      await expect(
        prisma.guardianship.create({
          data: {
            organizationId: orgA,
            guardianPersonId: p,
            wardPersonId: p,
            relationTypeId,
          },
        }),
      ).rejects.toThrow();
    });

    it('allows at most one active primary guardian per ward — the database, not the service, decides', async () => {
      const ward = await makePerson(orgA, 'primary-race');
      const g1 = await makePerson(orgA, 'primary-1');
      const g2 = await makePerson(orgA, 'primary-2');

      await prisma.guardianship.create({
        data: {
          organizationId: orgA,
          guardianPersonId: g1,
          wardPersonId: ward,
          relationTypeId,
          isPrimary: true,
        },
      });

      await expect(
        prisma.guardianship.create({
          data: {
            organizationId: orgA,
            guardianPersonId: g2,
            wardPersonId: ward,
            relationTypeId,
            isPrimary: true,
          },
        }),
      ).rejects.toThrow();
    });

    it('allows at most one active financial guardian per ward', async () => {
      const ward = await makePerson(orgA, 'financial-race');
      const g1 = await makePerson(orgA, 'financial-1');
      const g2 = await makePerson(orgA, 'financial-2');

      await prisma.guardianship.create({
        data: {
          organizationId: orgA,
          guardianPersonId: g1,
          wardPersonId: ward,
          relationTypeId,
          isFinancialGuardian: true,
        },
      });

      await expect(
        prisma.guardianship.create({
          data: {
            organizationId: orgA,
            guardianPersonId: g2,
            wardPersonId: ward,
            relationTypeId,
            isFinancialGuardian: true,
          },
        }),
      ).rejects.toThrow();
    });

    it('rejects a second active Guardianship for the same pair', async () => {
      const ward = await makePerson(orgA, 'dup-pair-ward');
      const guardian = await makePerson(orgA, 'dup-pair-guardian');

      await prisma.guardianship.create({
        data: {
          organizationId: orgA,
          guardianPersonId: guardian,
          wardPersonId: ward,
          relationTypeId,
        },
      });

      await expect(
        prisma.guardianship.create({
          data: {
            organizationId: orgA,
            guardianPersonId: guardian,
            wardPersonId: ward,
            relationTypeId,
          },
        }),
      ).rejects.toThrow();
    });

    it('allows a new active row once the previous one has ended', async () => {
      const ward = await makePerson(orgA, 'reopen-ward');
      const guardian = await makePerson(orgA, 'reopen-guardian');

      const first = await prisma.guardianship.create({
        data: {
          organizationId: orgA,
          guardianPersonId: guardian,
          wardPersonId: ward,
          relationTypeId,
        },
      });
      await new Promise((r) => setTimeout(r, 5));
      await prisma.guardianship.update({
        where: { id: first.id },
        data: { endedAt: new Date() },
      });

      const second = await prisma.guardianship.create({
        data: {
          organizationId: orgA,
          guardianPersonId: guardian,
          wardPersonId: ward,
          relationTypeId,
        },
      });
      expect(second.id).not.toBe(first.id);
    });
  });

  describe('siblings — derived, never stored', () => {
    it('two wards sharing an active guardian are returned as siblings', async () => {
      const guardianPerson = await makePerson(orgA, 'shared-guardian');
      const child1 = await makePerson(orgA, 'sibling-1');
      const child2 = await makePerson(orgA, 'sibling-2');

      await prisma.guardianship.createMany({
        data: [
          {
            organizationId: orgA,
            guardianPersonId: guardianPerson,
            wardPersonId: child1,
            relationTypeId,
          },
          {
            organizationId: orgA,
            guardianPersonId: guardianPerson,
            wardPersonId: child2,
            relationTypeId,
          },
        ],
      });

      const siblingsOf1 = await guardianships.findSiblings(child1, orgScopeA);
      expect(siblingsOf1).toContain(child2);
    });
  });

  describe('organization isolation', () => {
    it('404s findByWard for a person outside the caller organization', async () => {
      const foreignPerson = await makePerson(orgB, 'foreign-ward');

      await expect(
        guardianships.findByWard(foreignPerson, orgScopeA),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s findByGuardianPerson for a person outside the caller organization', async () => {
      const foreignPerson = await makePerson(orgB, 'foreign-guardian');

      await expect(
        guardianships.findByGuardianPerson(foreignPerson, orgScopeA),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('event and audit payloads', () => {
    it('carries no PII into the guardian.created outbox event', async () => {
      const guardian = await guardians.create(
        {
          firstName: 'Sensitive',
          lastName: 'NameHere',
          mobilePrimary: '9998887770',
          dob: '1979-09-09',
        } as any,
        scopeA,
      );

      const events = await prisma.outboxEvent.findMany({
        where: { aggregateId: guardian.id },
      });
      const serialised = JSON.stringify(events);
      expect(serialised).not.toContain('Sensitive');
      expect(serialised).not.toContain('NameHere');
      expect(serialised).not.toContain('9998887770');
    });
  });
});
