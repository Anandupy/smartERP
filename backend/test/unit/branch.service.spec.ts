import { Test, TestingModule } from '@nestjs/testing';
import { BranchService } from '@/modules/branch/branch.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';

describe('BranchService (Unit)', () => {
  let service: BranchService;
  let prisma: PrismaService;

  beforeEach(async () => {
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
      ],
    }).compile();

    service = module.get<BranchService>(BranchService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Add more unit tests here for business logic validation without DB
});
