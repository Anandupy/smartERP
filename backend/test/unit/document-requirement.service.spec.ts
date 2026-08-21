import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdmissionApplicationStatus as S } from '@/generated/client';
import { DocumentRequirementService } from '@/modules/documents/document-requirement.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';

const SCOPE = { organizationId: 'org-1' };

const dto = (over: Record<string, unknown> = {}) => ({
  documentTypeId: 'dt-1',
  requiredByStage: S.UNDER_REVIEW,
  ...over,
});

describe('DocumentRequirementService', () => {
  let mockPrisma: any;
  let service: DocumentRequirementService;

  beforeEach(() => {
    mockPrisma = {
      documentRequirement: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new DocumentRequirementService(mockPrisma as PrismaService);
  });

  describe('create — duplicate prevention', () => {
    it('creates when no identical row exists', async () => {
      mockPrisma.documentRequirement.findFirst.mockResolvedValue(null);
      mockPrisma.documentRequirement.create.mockResolvedValue({ id: 'req-1' });

      await service.create(dto(), SCOPE);

      expect(mockPrisma.documentRequirement.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            deletedAt: null,
            branchId: null,
            documentTypeId: 'dt-1',
            appliesToProgramId: null,
            appliesToQuotaId: null,
            appliesToCategoryId: null,
            requiredByStage: S.UNDER_REVIEW,
          }),
        }),
      );
      expect(mockPrisma.documentRequirement.create).toHaveBeenCalled();
    });

    it('rejects an exact duplicate — same type, scope and stage', async () => {
      mockPrisma.documentRequirement.findFirst.mockResolvedValue({
        id: 'existing-req',
      });

      await expect(service.create(dto(), SCOPE)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.create(dto(), SCOPE)).rejects.toMatchObject({
        response: { error: 'DUPLICATE_DOCUMENT_REQUIREMENT' },
      });
      expect(mockPrisma.documentRequirement.create).not.toHaveBeenCalled();
    });

    it('does not treat a quota-specific row as a duplicate of the base rule', async () => {
      // The service call itself only ever queries for the exact identity it
      // was given — a quota-scoped create and a base create carry different
      // appliesToQuotaId values, so they are different queries by construction.
      mockPrisma.documentRequirement.findFirst.mockResolvedValue(null);
      mockPrisma.documentRequirement.create.mockResolvedValue({ id: 'req-2' });

      await service.create(dto({ appliesToQuotaId: 'quota-rte' }), SCOPE);

      expect(mockPrisma.documentRequirement.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ appliesToQuotaId: 'quota-rte' }),
        }),
      );
    });

    it('allows the same document type at a different stage', async () => {
      mockPrisma.documentRequirement.findFirst.mockResolvedValue(null);
      mockPrisma.documentRequirement.create.mockResolvedValue({ id: 'req-3' });

      await service.create(dto({ requiredByStage: S.APPROVED }), SCOPE);

      expect(mockPrisma.documentRequirement.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ requiredByStage: S.APPROVED }),
        }),
      );
    });
  });

  describe('update — duplicate prevention', () => {
    const EXISTING = {
      id: 'req-1',
      organizationId: 'org-1',
      branchId: null,
      documentTypeId: 'dt-1',
      appliesToProgramId: null,
      appliesToQuotaId: null,
      appliesToCategoryId: null,
      requiredByStage: S.UNDER_REVIEW,
      deletedAt: null,
    };

    it('skips the duplicate check when identity fields are untouched', async () => {
      mockPrisma.documentRequirement.findFirst.mockResolvedValueOnce(EXISTING);
      mockPrisma.documentRequirement.update.mockResolvedValue(EXISTING);

      await service.update('req-1', { isMandatory: false }, SCOPE);

      // Only the findOne lookup runs — no second findFirst for duplicates.
      expect(mockPrisma.documentRequirement.findFirst).toHaveBeenCalledTimes(1);
    });

    it('rejects an update that collides with another existing row', async () => {
      mockPrisma.documentRequirement.findFirst
        .mockResolvedValueOnce(EXISTING) // findOne
        .mockResolvedValueOnce({ id: 'other-req' }); // duplicate check

      await expect(
        service.update('req-1', { appliesToCategoryId: 'cat-sc' }, SCOPE),
      ).rejects.toMatchObject({
        response: { error: 'DUPLICATE_DOCUMENT_REQUIREMENT' },
      });

      const dupCall = mockPrisma.documentRequirement.findFirst.mock.calls[1][0];
      expect(dupCall.where.id).toEqual({ not: 'req-1' });
      expect(dupCall.where.appliesToCategoryId).toBe('cat-sc');
    });

    it('throws NotFoundException for a requirement outside the scope', async () => {
      mockPrisma.documentRequirement.findFirst.mockResolvedValue(null);

      await expect(
        service.update('missing-req', { isMandatory: false }, SCOPE),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
