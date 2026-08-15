import { NotFoundException } from '@nestjs/common';
import { GuardianshipService } from '@/modules/admissions/guardians/guardianship.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';

/**
 * R4.5 — Guardianship (§8.5, §9).
 *
 * `ApplicantGuardianMapping` stays authoritative for one application;
 * `Guardianship` is the Person-to-Person record that survives admission.
 * These tests lock the sync/exclusivity logic that the database constraints
 * (added in the R4.5 migration) back up as the actual guarantee.
 */
const ORG = 'org-1';
const GUARDIAN_PERSON = 'guardian-person-1';
const WARD_PERSON = 'ward-person-1';

const input = (over: Record<string, unknown> = {}) => ({
  organizationId: ORG,
  guardianPersonId: GUARDIAN_PERSON,
  wardPersonId: WARD_PERSON,
  relationTypeId: 'rel-1',
  isPrimary: false,
  isFinancialGuardian: false,
  isEmergencyContact: false,
  pickupAllowed: true,
  ...over,
});

describe('GuardianshipService', () => {
  let mockTx: any;
  let mockPrisma: any;
  let mockOutbox: { enqueue: jest.Mock };
  let service: GuardianshipService;

  beforeEach(() => {
    mockTx = {
      guardianship: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      applicantGuardianMapping: { findMany: jest.fn() },
    };
    mockPrisma = {
      person: { findFirst: jest.fn() },
      guardianship: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    mockOutbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new GuardianshipService(
      mockPrisma as PrismaService,
      mockOutbox as unknown as OutboxPublisher,
    );
  });

  describe('syncOne', () => {
    it('refuses to link a person as their own guardian', async () => {
      const result = await service.syncOne(
        mockTx,
        input({ guardianPersonId: WARD_PERSON, wardPersonId: WARD_PERSON }),
      );

      expect(result.created).toBe(false);
      expect(mockTx.guardianship.create).not.toHaveBeenCalled();
    });

    it('creates a new Guardianship and publishes an event when none exists', async () => {
      mockTx.guardianship.findFirst.mockResolvedValue(null);
      mockTx.guardianship.create.mockResolvedValue({ id: 'gs-1' });

      const result = await service.syncOne(mockTx, input());

      expect(result).toEqual({ id: 'gs-1', created: true });
      expect(mockTx.guardianship.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guardianPersonId: GUARDIAN_PERSON,
          wardPersonId: WARD_PERSON,
        }),
      });
      expect(mockOutbox.enqueue).toHaveBeenCalledTimes(1);
      const published = mockOutbox.enqueue.mock.calls[0][0];
      expect(published.payload).toEqual({
        guardianshipId: 'gs-1',
        organizationId: ORG,
        guardianPersonId: GUARDIAN_PERSON,
        wardPersonId: WARD_PERSON,
        relationTypeId: 'rel-1',
      });
    });

    it('updates the existing active row instead of creating a second one', async () => {
      mockTx.guardianship.findFirst.mockResolvedValue({ id: 'gs-existing' });
      mockTx.guardianship.update.mockResolvedValue({ id: 'gs-existing' });

      const result = await service.syncOne(
        mockTx,
        input({ isEmergencyContact: true }),
      );

      expect(result).toEqual({ id: 'gs-existing', created: false });
      expect(mockTx.guardianship.create).not.toHaveBeenCalled();
      expect(mockTx.guardianship.update).toHaveBeenCalledWith({
        where: { id: 'gs-existing' },
        data: expect.objectContaining({ isEmergencyContact: true }),
      });
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });

    it('clears other active primaries for the ward before setting isPrimary', async () => {
      mockTx.guardianship.findFirst.mockResolvedValue(null);
      mockTx.guardianship.create.mockResolvedValue({ id: 'gs-2' });

      await service.syncOne(mockTx, input({ isPrimary: true }));

      expect(mockTx.guardianship.updateMany).toHaveBeenCalledWith({
        where: { wardPersonId: WARD_PERSON, isPrimary: true, endedAt: null },
        data: { isPrimary: false },
      });
    });

    it('clears other active financial guardians for the ward before setting isFinancialGuardian', async () => {
      mockTx.guardianship.findFirst.mockResolvedValue(null);
      mockTx.guardianship.create.mockResolvedValue({ id: 'gs-3' });

      await service.syncOne(mockTx, input({ isFinancialGuardian: true }));

      expect(mockTx.guardianship.updateMany).toHaveBeenCalledWith({
        where: {
          wardPersonId: WARD_PERSON,
          isFinancialGuardian: true,
          endedAt: null,
        },
        data: { isFinancialGuardian: false },
      });
    });

    it('excludes its own row from the primary-clear when updating', async () => {
      mockTx.guardianship.findFirst.mockResolvedValue({ id: 'gs-self' });
      mockTx.guardianship.update.mockResolvedValue({ id: 'gs-self' });

      await service.syncOne(mockTx, input({ isPrimary: true }));

      expect(mockTx.guardianship.updateMany).toHaveBeenCalledWith({
        where: {
          wardPersonId: WARD_PERSON,
          isPrimary: true,
          endedAt: null,
          id: { not: 'gs-self' },
        },
        data: { isPrimary: false },
      });
    });
  });

  describe('syncFromApplicantMappings', () => {
    it('skips mappings whose guardian has no resolved Person', async () => {
      mockTx.applicantGuardianMapping.findMany.mockResolvedValue([
        {
          guardianId: 'g1',
          guardian: { personId: null },
          relationTypeId: 'rel-1',
          isPrimary: false,
          isFinancialGuardian: false,
          isEmergencyContact: false,
          pickupAllowed: true,
        },
      ]);

      await service.syncFromApplicantMappings(
        mockTx,
        'app-1',
        ORG,
        WARD_PERSON,
      );

      expect(mockTx.guardianship.create).not.toHaveBeenCalled();
    });

    it('syncs each mapping whose guardian does have a resolved Person', async () => {
      mockTx.applicantGuardianMapping.findMany.mockResolvedValue([
        {
          guardianId: 'g1',
          guardian: { personId: GUARDIAN_PERSON },
          relationTypeId: 'rel-1',
          isPrimary: true,
          isFinancialGuardian: false,
          isEmergencyContact: false,
          pickupAllowed: true,
        },
      ]);
      mockTx.guardianship.findFirst.mockResolvedValue(null);
      mockTx.guardianship.create.mockResolvedValue({ id: 'gs-4' });

      await service.syncFromApplicantMappings(
        mockTx,
        'app-1',
        ORG,
        WARD_PERSON,
      );

      expect(mockTx.guardianship.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guardianPersonId: GUARDIAN_PERSON,
          wardPersonId: WARD_PERSON,
          isPrimary: true,
        }),
      });
    });
  });

  describe('read paths — organization isolation', () => {
    it('404s findByWard when the ward is outside the caller organization', async () => {
      mockPrisma.person.findFirst.mockResolvedValue(null);

      await expect(
        service.findByWard(WARD_PERSON, { organizationId: ORG }),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s findByGuardianPerson when outside the caller organization', async () => {
      mockPrisma.person.findFirst.mockResolvedValue(null);

      await expect(
        service.findByGuardianPerson(GUARDIAN_PERSON, {
          organizationId: ORG,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s findSiblings when the ward is outside the caller organization', async () => {
      mockPrisma.person.findFirst.mockResolvedValue(null);

      await expect(
        service.findSiblings(WARD_PERSON, { organizationId: ORG }),
      ).rejects.toThrow(NotFoundException);
    });

    it('scopes findByWard to only active, in-organization rows', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: WARD_PERSON });
      mockPrisma.guardianship.findMany.mockResolvedValue([]);

      await service.findByWard(WARD_PERSON, { organizationId: ORG });

      expect(mockPrisma.guardianship.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            wardPersonId: WARD_PERSON,
            organizationId: ORG,
            endedAt: null,
          },
        }),
      );
    });
  });
});
