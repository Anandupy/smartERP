import {
  AdmissionApplicationStatus as S,
  DocumentOwnerType,
} from '@/generated/client';
import {
  ChecklistService,
  ENFORCEABLE_REQUIREMENT_STAGES,
} from '@/modules/documents/checklist.service';
import { checklistEnforcedStages } from '@/modules/admissions/workflow/workflow.transitions';
import { PrismaService } from '@/infrastructure/database/prisma.service';

const APPLICANT = {
  applicantId: 'app-1',
  branchId: 'branch-1',
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
      document: { findFirst: jest.fn(), findMany: jest.fn() },
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

  it('filters out a requirement scoped to a different quotaId', async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([
      requirement({ appliesToQuotaId: 'some-other-quota' }),
    ]);

    const result = await service.isSatisfied(
      APPLICANT,
      [S.UNDER_REVIEW],
      'org-1',
    );

    expect(result).toEqual({ satisfied: true, missing: [] });
    expect(mockPrisma.document.findFirst).not.toHaveBeenCalled();
  });

  it("applies a requirement scoped to the applicant's own quotaId — e.g. an RTE-only income certificate", async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([
      requirement({
        documentTypeId: 'dt-income',
        appliesToQuotaId: 'quota-1',
        documentType: {
          id: 'dt-income',
          code: 'INCOME_CERTIFICATE',
          name: 'Income Certificate',
        },
      }),
    ]);
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const result = await service.isSatisfied(
      APPLICANT,
      [S.UNDER_REVIEW],
      'org-1',
    );

    expect(result.satisfied).toBe(false);
    expect(result.missing).toEqual([
      {
        documentTypeId: 'dt-income',
        code: 'INCOME_CERTIFICATE',
        name: 'Income Certificate',
      },
    ]);
  });

  it('filters out a requirement scoped to a different categoryId', async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([
      requirement({ appliesToCategoryId: 'some-other-category' }),
    ]);

    const result = await service.isSatisfied(
      APPLICANT,
      [S.UNDER_REVIEW],
      'org-1',
    );

    expect(result).toEqual({ satisfied: true, missing: [] });
    expect(mockPrisma.document.findFirst).not.toHaveBeenCalled();
  });

  it("applies a requirement scoped to the applicant's own categoryId — e.g. an SC-only caste certificate", async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([
      requirement({
        documentTypeId: 'dt-caste',
        appliesToCategoryId: 'cat-1',
        documentType: {
          id: 'dt-caste',
          code: 'CASTE_CERTIFICATE',
          name: 'Caste Certificate',
        },
      }),
    ]);
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const result = await service.isSatisfied(
      APPLICANT,
      [S.UNDER_REVIEW],
      'org-1',
    );

    expect(result.satisfied).toBe(false);
    expect(result.missing.map((m) => m.code)).toEqual(['CASTE_CERTIFICATE']);
  });

  it('does not require a category document for an applicant in a different category', async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([
      requirement({ appliesToCategoryId: 'cat-sc' }),
    ]);

    const result = await service.isSatisfied(
      { ...APPLICANT, categoryId: 'cat-general' },
      [S.UNDER_REVIEW],
      'org-1',
    );

    expect(result).toEqual({ satisfied: true, missing: [] });
  });

  it('is additive: a base program requirement and a quota-specific requirement are both checked independently', async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([
      requirement({
        documentTypeId: 'dt-birth',
        appliesToProgramId: 'prog-1',
        documentType: {
          id: 'dt-birth',
          code: 'BIRTH_CERTIFICATE',
          name: 'Birth Certificate',
        },
      }),
      requirement({
        documentTypeId: 'dt-income',
        appliesToProgramId: 'prog-1',
        appliesToQuotaId: 'quota-1',
        documentType: {
          id: 'dt-income',
          code: 'INCOME_CERTIFICATE',
          name: 'Income Certificate',
        },
      }),
    ]);
    // The base document is on file; the RTE-specific one is not.
    mockPrisma.document.findFirst.mockImplementation(async ({ where }: any) =>
      where.documentTypeId === 'dt-birth' ? { id: 'doc-1' } : null,
    );

    const result = await service.isSatisfied(
      APPLICANT,
      [S.UNDER_REVIEW],
      'org-1',
    );

    expect(mockPrisma.document.findFirst).toHaveBeenCalledTimes(2);
    expect(result.satisfied).toBe(false);
    expect(result.missing).toEqual([
      {
        documentTypeId: 'dt-income',
        code: 'INCOME_CERTIFICATE',
        name: 'Income Certificate',
      },
    ]);
  });

  it('only ever queries mandatory, active, non-deleted requirements at the requested stages', async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([]);

    await service.isSatisfied(APPLICANT, [S.UNDER_REVIEW, S.APPROVED], 'org-1');

    expect(mockPrisma.documentRequirement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          isMandatory: true,
          isActive: true,
          deletedAt: null,
          requiredByStage: { in: [S.UNDER_REVIEW, S.APPROVED] },
        }),
      }),
    );
  });

  it('only a VERIFIED current version satisfies a requirement — PENDING and REJECTED do not', async () => {
    mockPrisma.documentRequirement.findMany.mockResolvedValue([requirement()]);
    mockPrisma.document.findFirst.mockResolvedValue(null);

    await service.isSatisfied(APPLICANT, [S.UNDER_REVIEW], 'org-1');

    expect(mockPrisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          currentVersion: { verificationStatus: 'VERIFIED' },
        }),
      }),
    );
  });

  describe('branch scoping (D1)', () => {
    it("binds organization-wide requirements and only this branch's own", async () => {
      mockPrisma.documentRequirement.findMany.mockResolvedValue([]);

      await service.isSatisfied(APPLICANT, [S.UNDER_REVIEW], 'org-1');

      expect(mockPrisma.documentRequirement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            OR: [{ branchId: null }, { branchId: 'branch-1' }],
          }),
        }),
      );
    });

    it('never consults another organization', async () => {
      mockPrisma.documentRequirement.findMany.mockResolvedValue([]);

      await service.isSatisfied(APPLICANT, [S.UNDER_REVIEW], 'org-1');

      const where =
        mockPrisma.documentRequirement.findMany.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-1');
    });

    it('uses the same branch filter for the checklist read model', async () => {
      mockPrisma.documentRequirement.findMany.mockResolvedValue([]);

      await service.describe(APPLICANT, 'org-1');

      expect(mockPrisma.documentRequirement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ branchId: null }, { branchId: 'branch-1' }],
          }),
        }),
      );
    });
  });

  describe('describe — the checklist read model', () => {
    const req = (id: string, documentTypeId: string, over = {}) => ({
      id,
      branchId: null,
      requiredByStage: S.UNDER_REVIEW,
      isMandatory: true,
      ...requirement({
        documentTypeId,
        documentType: {
          id: documentTypeId,
          code: documentTypeId,
          name: documentTypeId,
        },
      }),
      ...over,
    });

    it('reports VERIFIED, PENDING_VERIFICATION, REJECTED and MISSING, and only VERIFIED satisfies', async () => {
      mockPrisma.documentRequirement.findMany.mockResolvedValue([
        req('r-1', 'verified'),
        req('r-2', 'pending'),
        req('r-3', 'rejected'),
        req('r-4', 'missing'),
      ]);
      mockPrisma.document.findMany.mockResolvedValue([
        {
          id: 'd-1',
          documentTypeId: 'verified',
          currentVersion: { verificationStatus: 'VERIFIED' },
        },
        {
          id: 'd-2',
          documentTypeId: 'pending',
          currentVersion: { verificationStatus: 'PENDING' },
        },
        {
          id: 'd-3',
          documentTypeId: 'rejected',
          currentVersion: { verificationStatus: 'REJECTED' },
        },
      ]);

      const items = await service.describe(APPLICANT, 'org-1');
      const byType = Object.fromEntries(
        items.map((i) => [i.documentTypeId, i]),
      );

      expect(byType.verified).toMatchObject({
        status: 'VERIFIED',
        satisfied: true,
        documentId: 'd-1',
      });
      expect(byType.pending).toMatchObject({
        status: 'PENDING_VERIFICATION',
        satisfied: false,
      });
      expect(byType.rejected).toMatchObject({
        status: 'REJECTED',
        satisfied: false,
      });
      expect(byType.missing).toMatchObject({
        status: 'MISSING',
        satisfied: false,
        documentId: null,
      });
    });

    it('prefers a verified copy when several documents of the type exist', async () => {
      mockPrisma.documentRequirement.findMany.mockResolvedValue([
        req('r-1', 'birth'),
      ]);
      mockPrisma.document.findMany.mockResolvedValue([
        {
          id: 'old',
          documentTypeId: 'birth',
          currentVersion: { verificationStatus: 'REJECTED' },
        },
        {
          id: 'new',
          documentTypeId: 'birth',
          currentVersion: { verificationStatus: 'VERIFIED' },
        },
      ]);

      const [item] = await service.describe(APPLICANT, 'org-1');
      expect(item).toMatchObject({ status: 'VERIFIED', documentId: 'new' });
    });

    it('applies the same programme filter as the guard', async () => {
      mockPrisma.documentRequirement.findMany.mockResolvedValue([
        req('r-1', 'mine', { appliesToProgramId: 'prog-1' }),
        req('r-2', 'other', { appliesToProgramId: 'prog-2' }),
      ]);
      mockPrisma.document.findMany.mockResolvedValue([]);

      const items = await service.describe(APPLICANT, 'org-1');
      expect(items.map((i) => i.documentTypeId)).toEqual(['mine']);
    });
  });

  it('the enforceable stages are exactly the stages a checklist-guarded transition touches', () => {
    expect([...ENFORCEABLE_REQUIREMENT_STAGES].sort()).toEqual(
      [...checklistEnforcedStages()].sort(),
    );
  });
});
