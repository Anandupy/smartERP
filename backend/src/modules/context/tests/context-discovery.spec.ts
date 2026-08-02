import { Test, TestingModule } from '@nestjs/testing';
import { ContextDiscoveryService } from '../services/context-discovery.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RoleType } from '@/generated/client';

describe('ContextDiscoveryService', () => {
  let discovery: ContextDiscoveryService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      organization: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      branch: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      academicYear: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextDiscoveryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    discovery = module.get<ContextDiscoveryService>(ContextDiscoveryService);
  });

  it('should discover all active orgs for Super Admin', async () => {
    prisma.organization.findMany.mockResolvedValue([
      { id: 'org-1', name: 'Org 1', code: 'O1', status: 'ACTIVE' },
      { id: 'org-2', name: 'Org 2', code: 'O2', status: 'ACTIVE' },
    ]);
    prisma.branch.findMany.mockResolvedValue([]);
    prisma.academicYear.findMany.mockResolvedValue([]);

    const res = await discovery.discoverContexts(
      'user-sa',
      RoleType.SUPER_ADMIN,
    );
    expect(res.availableOrganizations).toHaveLength(2);
    expect(prisma.organization.findMany).toHaveBeenCalled();
  });

  it('should discover assigned org for Org Admin', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org-1',
      name: 'Org 1',
      code: 'O1',
      status: 'ACTIVE',
    });
    prisma.branch.findMany.mockResolvedValue([
      {
        id: 'branch-1',
        organizationId: 'org-1',
        name: 'B1',
        code: 'B1',
        institutionType: 'K12',
        isActive: true,
      },
    ]);
    prisma.academicYear.findMany.mockResolvedValue([]);

    const res = await discovery.discoverContexts(
      'user-oa',
      RoleType.ORG_ADMIN,
      'org-1',
    );
    expect(res.availableOrganizations).toHaveLength(1);
    expect(res.availableBranches).toHaveLength(1);
  });
});
