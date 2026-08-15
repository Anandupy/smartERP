import { NotFoundException } from '@nestjs/common';
import { DocumentOwnerType } from '@/generated/client';
import { OwnerResolverService } from '@/modules/documents/owner-resolver.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ResourceScope } from '@/common/scope/resource-scope';

const SCOPE: ResourceScope = {
  organizationId: 'org-1',
  branchId: 'branch-1',
  academicYearId: 'year-1',
};

describe('OwnerResolverService', () => {
  let mockPrisma: any;
  let service: OwnerResolverService;

  beforeEach(() => {
    mockPrisma = {
      person: { findFirst: jest.fn() },
      student: { findFirst: jest.fn() },
      applicant: { findFirst: jest.fn() },
      admission: { findFirst: jest.fn() },
      enrollment: { findFirst: jest.fn() },
      branch: { findFirst: jest.fn() },
    };
    service = new OwnerResolverService(mockPrisma as PrismaService);
  });

  it('resolves a PERSON owner to an organization-scoped result (no branchId)', async () => {
    mockPrisma.person.findFirst.mockResolvedValue({ id: 'p-1' });
    const result = await service.resolve(
      DocumentOwnerType.PERSON,
      'p-1',
      SCOPE,
    );
    expect(result).toEqual({ organizationId: 'org-1', branchId: null });
    expect(mockPrisma.person.findFirst).toHaveBeenCalledWith({
      where: { id: 'p-1', organizationId: 'org-1' },
      select: { id: true },
    });
  });

  it('404s a PERSON owner outside the caller organization', async () => {
    mockPrisma.person.findFirst.mockResolvedValue(null);
    await expect(
      service.resolve(DocumentOwnerType.PERSON, 'p-cross-org', SCOPE),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolves a STUDENT owner to organization scope even though Student.branchId can move', async () => {
    mockPrisma.student.findFirst.mockResolvedValue({ id: 's-1' });
    const result = await service.resolve(
      DocumentOwnerType.STUDENT,
      's-1',
      SCOPE,
    );
    expect(result).toEqual({ organizationId: 'org-1', branchId: null });
  });

  it("resolves an APPLICANT owner to the applicant's own branch, scoped to the caller's branch", async () => {
    mockPrisma.applicant.findFirst.mockResolvedValue({
      id: 'app-1',
      branchId: 'branch-1',
    });
    const result = await service.resolve(
      DocumentOwnerType.APPLICANT,
      'app-1',
      SCOPE,
    );
    expect(result).toEqual({ organizationId: 'org-1', branchId: 'branch-1' });
    expect(mockPrisma.applicant.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'app-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        deletedAt: null,
      },
      select: { id: true, branchId: true },
    });
  });

  it('404s an APPLICANT owner from a different branch', async () => {
    mockPrisma.applicant.findFirst.mockResolvedValue(null);
    await expect(
      service.resolve(DocumentOwnerType.APPLICANT, 'app-other-branch', SCOPE),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolves an ADMISSION owner to its own branchId', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      branchId: 'branch-1',
    });
    const result = await service.resolve(
      DocumentOwnerType.ADMISSION,
      'adm-1',
      SCOPE,
    );
    expect(result).toEqual({ organizationId: 'org-1', branchId: 'branch-1' });
  });

  it('resolves an ENROLLMENT owner to its own branchId', async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue({
      id: 'enr-1',
      branchId: 'branch-1',
    });
    const result = await service.resolve(
      DocumentOwnerType.ENROLLMENT,
      'enr-1',
      SCOPE,
    );
    expect(result).toEqual({ organizationId: 'org-1', branchId: 'branch-1' });
  });

  it('resolves ORGANIZATION only when ownerId matches the caller organization', async () => {
    const result = await service.resolve(
      DocumentOwnerType.ORGANIZATION,
      'org-1',
      SCOPE,
    );
    expect(result).toEqual({ organizationId: 'org-1', branchId: null });
  });

  it('404s ORGANIZATION when ownerId is a different organization', async () => {
    await expect(
      service.resolve(DocumentOwnerType.ORGANIZATION, 'org-2', SCOPE),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolves a BRANCH owner to its own id as branchId', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-9' });
    const result = await service.resolve(
      DocumentOwnerType.BRANCH,
      'branch-9',
      SCOPE,
    );
    expect(result).toEqual({ organizationId: 'org-1', branchId: 'branch-9' });
  });
});
