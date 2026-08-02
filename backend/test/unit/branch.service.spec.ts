import { Test, TestingModule } from '@nestjs/testing';
import { BranchService } from '@/modules/branch/branch.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { RequestContextService } from '@/common/logger/request-context.service';

describe('BranchService (Unit)', () => {
  let service: BranchService;
  let prisma: PrismaService;
  let requestContext: RequestContextService;
  let mockEventBus: { publish: jest.Mock; subscribe: jest.Mock };

  beforeEach(async () => {
    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchService,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findUnique: jest.fn(),
            },
            branch: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
        {
          provide: RequestContextService,
          useValue: { getContext: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<BranchService>(BranchService);
    prisma = module.get<PrismaService>(PrismaService);
    requestContext = module.get<RequestContextService>(RequestContextService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllBranches tenant scoping', () => {
    const listFor = async (context: unknown) => {
      (requestContext.getContext as jest.Mock).mockReturnValue(context);
      (prisma.branch.findMany as jest.Mock).mockResolvedValue([]);
      await service.getAllBranches();
      return (prisma.branch.findMany as jest.Mock).mock.calls.at(-1)![0].where;
    };

    it('restricts a non-super-admin to their own organization', async () => {
      // GET /branches requires only settings.view, which ORG_ADMIN holds, so an
      // unscoped query let one tenant enumerate every other tenant's branches.
      const where = await listFor({
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
      });

      expect(where).toEqual({ isDeleted: false, organizationId: 'org-1' });
    });

    it('lets SUPER_ADMIN see every organization', async () => {
      const where = await listFor({
        role: 'SUPER_ADMIN',
        organizationId: 'org-1',
      });

      expect(where).toEqual({ isDeleted: false });
    });
  });
});
