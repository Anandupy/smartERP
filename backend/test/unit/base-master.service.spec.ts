import { ConflictException, NotFoundException } from '@nestjs/common';
import { BaseMasterService } from '@/modules/admissions/masters/base-master.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { ResourceScope } from '@/common/scope/resource-scope';

/**
 * R3 — Admissions Masters hardening.
 *
 * Before this change `findOne`/`update`/`remove` filtered only by
 * `id + deletedAt: null`: any authenticated caller who knew a master's UUID
 * could read, edit or soft-delete a record belonging to a different
 * organization or branch. This suite locks the fixed scope-safety and
 * reference-protection behaviour in place.
 */
const SCOPE: ResourceScope = {
  organizationId: 'org-1',
  branchId: 'branch-1',
  academicYearId: null,
};

const OTHER_BRANCH_SCOPE: ResourceScope = {
  organizationId: 'org-1',
  branchId: 'branch-2',
  academicYearId: null,
};

const OTHER_ORG_SCOPE: ResourceScope = {
  organizationId: 'org-2',
  branchId: 'branch-9',
  academicYearId: null,
};

describe('BaseMasterService', () => {
  let mockPrisma: any;
  let mockEventBus: { publish: jest.Mock };
  let service: BaseMasterService;

  beforeEach(() => {
    mockPrisma = {
      religion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new BaseMasterService(mockPrisma as PrismaService, 'religion', [
      'applicants',
      'students',
    ]);
    (service as any).eventBus = mockEventBus as unknown as EventBus;
  });

  describe('create', () => {
    it('stamps the caller scope onto the created row and publishes an event', async () => {
      mockPrisma.religion.findFirst.mockResolvedValue(null);
      mockPrisma.religion.create.mockResolvedValue({
        id: 'rel-1',
        code: 'HIND',
        name: 'Hindu',
      });

      await service.create({ code: 'HIND', name: 'Hindu' }, SCOPE);

      expect(mockPrisma.religion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'HIND',
          name: 'Hindu',
          organizationId: SCOPE.organizationId,
          branchId: SCOPE.branchId,
        }),
      });
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('rejects a duplicate code case-insensitively with a structured conflict', async () => {
      mockPrisma.religion.findFirst.mockResolvedValueOnce({ id: 'existing' });

      const error: ConflictException = await service
        .create({ code: 'gen', name: 'General' }, SCOPE)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ error: 'DUPLICATE_CODE' });
    });

    it('rejects a duplicate name case-insensitively with a structured conflict', async () => {
      mockPrisma.religion.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing' });

      const error: ConflictException = await service
        .create({ code: 'GEN2', name: 'GENERAL' }, SCOPE)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ error: 'DUPLICATE_NAME' });
    });

    it('scopes the duplicate check to the caller branch, not the whole org', async () => {
      mockPrisma.religion.findFirst.mockResolvedValue(null);
      mockPrisma.religion.create.mockResolvedValue({ id: 'rel-2' });

      await service.create({ code: 'GEN', name: 'General' }, SCOPE);

      expect(mockPrisma.religion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: SCOPE.organizationId,
            branchId: SCOPE.branchId,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('unions global defaults, org-wide defaults and the caller branch', async () => {
      mockPrisma.religion.findMany.mockResolvedValue([]);

      await service.findAll(SCOPE, false);

      expect(mockPrisma.religion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { organizationId: null, branchId: null },
              { organizationId: SCOPE.organizationId, branchId: null },
              {
                organizationId: SCOPE.organizationId,
                branchId: SCOPE.branchId,
              },
            ],
            deletedAt: null,
            isActive: true,
          }),
        }),
      );
    });

    it('includes inactive rows only when explicitly asked', async () => {
      mockPrisma.religion.findMany.mockResolvedValue([]);

      await service.findAll(SCOPE, true);

      const where = mockPrisma.religion.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBeUndefined();
    });
  });

  describe('findOne — visibility and tenant isolation', () => {
    it('returns a row scoped exactly to the caller branch', async () => {
      mockPrisma.religion.findFirst.mockResolvedValue({ id: 'rel-1' });

      const result = await service.findOne('rel-1', SCOPE);

      expect(result).toEqual({ id: 'rel-1' });
    });

    it('404s — never leaks via 403 — when the row belongs to another organization', async () => {
      mockPrisma.religion.findFirst.mockResolvedValue(null);

      await expect(service.findOne('rel-1', OTHER_ORG_SCOPE)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('applies the visible-scope filter, not a bare id lookup', async () => {
      mockPrisma.religion.findFirst.mockResolvedValue({ id: 'rel-1' });

      await service.findOne('rel-1', SCOPE);

      expect(mockPrisma.religion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'rel-1',
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('update — mutation requires exact branch ownership', () => {
    it('updates a row owned exactly by the caller branch', async () => {
      mockPrisma.religion.findFirst.mockResolvedValueOnce({ id: 'rel-1' }); // ownership check
      mockPrisma.religion.findFirst.mockResolvedValue(null); // no duplicate
      mockPrisma.religion.update.mockResolvedValue({
        id: 'rel-1',
        code: 'HIND2',
        name: 'Hindu',
      });

      await service.update('rel-1', { code: 'HIND2' }, SCOPE);

      expect(mockPrisma.religion.update).toHaveBeenCalledWith({
        where: { id: 'rel-1' },
        data: { code: 'HIND2' },
      });
    });

    it('404s when the row is org-wide/global and not owned by this exact branch', async () => {
      mockPrisma.religion.findFirst.mockResolvedValue(null); // ownership check fails

      await expect(
        service.update('rel-1', { name: 'X' }, SCOPE),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.religion.update).not.toHaveBeenCalled();
    });

    it('404s — not 403 — when the row belongs to a different branch in the same org', async () => {
      mockPrisma.religion.findFirst.mockResolvedValue(null);

      await expect(
        service.update('rel-1', { name: 'X' }, OTHER_BRANCH_SCOPE),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove — reference protection', () => {
    it('blocks deletion of a referenced master with MASTER_IN_USE', async () => {
      mockPrisma.religion.findFirst
        .mockResolvedValueOnce({ id: 'rel-1' }) // ownership check
        .mockResolvedValueOnce({ applicants: [{ id: 'app-1' }], students: [] }); // usage check

      const error: ConflictException = await service
        .remove('rel-1', SCOPE)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ error: 'MASTER_IN_USE' });
      expect(mockPrisma.religion.update).not.toHaveBeenCalled();
    });

    it('soft-deletes an unreferenced master and publishes an event', async () => {
      mockPrisma.religion.findFirst
        .mockResolvedValueOnce({ id: 'rel-1' }) // ownership check
        .mockResolvedValueOnce({ applicants: [], students: [] }); // usage check
      mockPrisma.religion.update.mockResolvedValue({
        id: 'rel-1',
        deletedAt: new Date(),
      });

      await service.remove('rel-1', SCOPE);

      expect(mockPrisma.religion.update).toHaveBeenCalledWith({
        where: { id: 'rel-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('404s when the caller does not own the row, before checking references', async () => {
      mockPrisma.religion.findFirst.mockResolvedValueOnce(null);

      await expect(service.remove('rel-1', SCOPE)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.religion.update).not.toHaveBeenCalled();
    });
  });

  describe('a master with no reference relations configured', () => {
    it('never blocks deletion, since it has nothing to protect', async () => {
      const unguarded = new BaseMasterService(
        mockPrisma as PrismaService,
        'religion',
      );
      (unguarded as any).eventBus = mockEventBus;
      mockPrisma.religion.findFirst.mockResolvedValueOnce({ id: 'rel-1' });
      mockPrisma.religion.update.mockResolvedValue({ id: 'rel-1' });

      await unguarded.remove('rel-1', SCOPE);

      expect(mockPrisma.religion.update).toHaveBeenCalled();
    });
  });
});
