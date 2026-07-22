import { Test, TestingModule } from '@nestjs/testing';
import { AuditRepository } from '@/infrastructure/audit/audit.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

describe('AuditRepository', () => {
  let repository: AuditRepository;
  let prisma: PrismaService;

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get<AuditRepository>(AuditRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create an AuditLog record in Prisma', async () => {
    const mockAuditData = {
      id: '018f6f4c-1234-789a-bcde-f0123456789a',
      eventName: 'student.created',
      action: 'CREATE',
      module: 'ADMISSIONS',
      aggregateType: 'Student',
      aggregateId: 'stud-101',
      userId: 'user-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      severity: 'INFO' as const,
      status: 'SUCCESS' as const,
    };

    mockPrisma.auditLog.create.mockResolvedValue({ id: mockAuditData.id, ...mockAuditData });

    const result = await repository.createAuditLog(mockAuditData);

    expect(result).toBeDefined();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventName: 'student.created',
        action: 'CREATE',
        module: 'ADMISSIONS',
        aggregateId: 'stud-101',
      }),
    });
  });

  it('should catch database errors gracefully without throwing', async () => {
    mockPrisma.auditLog.create.mockRejectedValue(new Error('Database error'));

    const result = await repository.createAuditLog({
      eventName: 'student.created',
      action: 'CREATE',
      module: 'ADMISSIONS',
      aggregateType: 'Student',
      aggregateId: 'stud-101',
    });

    expect(result).toBeNull();
  });

  it('should query audit logs using filters', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    await repository.findAuditLogs({ module: 'ADMISSIONS', aggregateId: 'stud-101' });

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        module: 'ADMISSIONS',
        aggregateType: undefined,
        aggregateId: 'stud-101',
        userId: undefined,
        action: undefined,
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
  });
});
