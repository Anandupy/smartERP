import {
  AdmissionApplicationStatus as S,
  DocumentOwnerType,
} from '@/generated/client';
import { ChecklistService } from '@/modules/documents/checklist.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';

const APPLICANT = {
  applicantId: 'app-1',
  personId: 'person-1',
  programId: 'prog-1',
  quotaId: 'quota-1',
  categoryId: 'cat-1',
};

const requirement = (over: Record<string, unknown> = {}) => ({
  documentTypeId: 'dt-1',
  appliesToProgramId: null,
  appliesToQuotaId: null,
  appliesToCategoryId: null,
  documentType: {
    id: 'dt-1',
    code: 'BIRTH_CERTIFICATE',
    name: 'Birth Certificate',
  },
  ...over,
});

describe('ChecklistService', () => {
  let mockPrisma: any;
  let service: ChecklistService;

  beforeEach(() => {
    mockPrisma = {
      documentRequirement: { findMany: jest.fn() },
      document: { findFirst: jest.fn() },
    };
    service = new ChecklistService(mockPrisma as PrismaService);
  });

  it('is trivially satisfied when no stages are supplied', async () => {
    const result = await service.isSatisfied(APPLICANT, [], 'org-1');
    expect(result).toEqual({ satisfied: true, missing: [] });
    expect(mockPrisma.documentRequirement.findMany).not.toHaveBeenCalled();
  });

  it('is satisfied when there are no applicable requirements', async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([]);
    const result = await service.isSatisfied(
      APPLICANT,
      [S.UNDER_REVIEW],
      'org-1',
    );
    expect(result).toEqual({ satisfied: true, missing: [] });
  });

  it('reports missing when no satisfying document exists', async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([requirement()]);
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const result = await service.isSatisfied(
      APPLICANT,
      [S.UNDER_REVIEW],
      'org-1',
    );

    expect(result.satisfied).toBe(false);
    expect(result.missing).toEqual([
      {
        documentTypeId: 'dt-1',
        code: 'BIRTH_CERTIFICATE',
        name: 'Birth Certificate',
      },
    ]);
  });

  it('is satisfied by a VERIFIED APPLICANT-owned or PERSON-owned document', async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([requirement()]);
    mockPrisma.document.findFirst.mockResolvedValue({ id: 'doc-1' });

    const result = await service.isSatisfied(
      APPLICANT,
      [S.UNDER_REVIEW],
      'org-1',
    );

    expect(result).toEqual({ satisfied: true, missing: [] });
    expect(mockPrisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          documentTypeId: 'dt-1',
          OR: [
            { ownerType: DocumentOwnerType.APPLICANT, ownerId: 'app-1' },
            { ownerType: DocumentOwnerType.PERSON, ownerId: 'person-1' },
          ],
        }),
      }),
    );
  });

  it('omits the PERSON owner filter when the applicant has no resolved Person yet', async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([requirement()]);
    mockPrisma.document.findFirst.mockResolvedValue(null);

    await service.isSatisfied(
      { ...APPLICANT, personId: null },
      [S.UNDER_REVIEW],
      'org-1',
    );

    expect(mockPrisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ ownerType: DocumentOwnerType.APPLICANT, ownerId: 'app-1' }],
        }),
      }),
    );
  });

  it('filters out a requirement scoped to a different programId', async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([
      requirement({ appliesToProgramId: 'some-other-program' }),
    ]);

    const result = await service.isSatisfied(
      APPLICANT,
      [S.UNDER_REVIEW],
      'org-1',
    );

    expect(result).toEqual({ satisfied: true, missing: [] });
    expect(mockPrisma.document.findFirst).not.toHaveBeenCalled();
  });

  it("applies a requirement scoped to the applicant's own programId", async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([
      requirement({ appliesToProgramId: 'prog-1' }),
    ]);
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const result = await service.isSatisfied(
      APPLICANT,
      [S.UNDER_REVIEW],
      'org-1',
    );

    expect(result.satisfied).toBe(false);
  });
});
