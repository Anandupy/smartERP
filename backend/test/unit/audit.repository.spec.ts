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
      count: jest.fn(),
      groupBy: jest.fn(),
      findFirst: jest.fn(),
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

    mockPrisma.auditLog.create.mockResolvedValue({ ...mockAuditData });

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

    await repository.findAuditLogs({
      module: 'ADMISSIONS',
      aggregateId: 'stud-101',
    });

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

  describe('Enterprise Querying and RBAC Isolation', () => {
    const mockSuperUser = { role: 'SUPER_ADMIN' };
    const mockOrgAdmin = { role: 'ORG_ADMIN', organizationId: 'org-123' };
    const mockBranchAdmin = { role: 'BRANCH_ADMIN', branchId: 'branch-456' };
    const mockStaff = { id: 'staff-999', role: 'STAFF' };

    it('SUPER_ADMIN should have no boundaries and honor passed filters', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(1);
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);

      await repository.queryAuditLogs(mockSuperUser, {
        organizationId: 'org-999',
        branchId: 'branch-999',
        userId: 'user-999',
        page: 2,
        limit: 10,
        sortBy: 'executionTime',
        sortOrder: 'asc',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-999',
            branchId: 'branch-999',
            userId: 'user-999',
          }),
          skip: 10,
          take: 10,
          orderBy: { executionTime: 'asc' },
        }),
      );
    });

    it('ORG_ADMIN should be restricted to organizationId and allow branch filter', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);

      await repository.queryAuditLogs(mockOrgAdmin, {
        organizationId: 'malicious-org',
        branchId: 'branch-1',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-123',
            branchId: 'branch-1',
          }),
        }),
      );
    });

    it('BRANCH_ADMIN should be restricted to branchId and ignore organization / other branch filters', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);

      await repository.queryAuditLogs(mockBranchAdmin, {
        organizationId: 'some-org',
        branchId: 'malicious-branch',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: 'branch-456',
          }),
        }),
      );
    });

    it('STAFF should be restricted to their own userId and ignore other scoping parameters', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);

      await repository.queryAuditLogs(mockStaff, {
        userId: 'malicious-user',
        organizationId: 'some-org',
        branchId: 'some-branch',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'staff-999',
          }),
        }),
      );
    });

    it('should support searching, min/max execution times and date ranges', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);

      const startDate = '2026-07-01T00:00:00.000Z';
      const endDate = '2026-07-26T23:59:59.000Z';

      await repository.queryAuditLogs(mockSuperUser, {
        search: 'auditKeyword',
        minExecutionTime: 50,
        maxExecutionTime: 200,
        startDate,
        endDate,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            executionTime: { gte: 50, lte: 200 },
            timestamp: { gte: new Date(startDate), lte: new Date(endDate) },
            OR: [
              { eventName: { contains: 'auditKeyword', mode: 'insensitive' } },
              { module: { contains: 'auditKeyword', mode: 'insensitive' } },
              {
                aggregateType: {
                  contains: 'auditKeyword',
                  mode: 'insensitive',
                },
              },
              { userEmail: { contains: 'auditKeyword', mode: 'insensitive' } },
              {
                aggregateId: { contains: 'auditKeyword', mode: 'insensitive' },
              },
            ],
          }),
        }),
      );
    });

    it('should exclude details metadata and changes by default', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);

      await repository.queryAuditLogs(mockSuperUser, {});

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            metadata: false,
            changes: false,
          }),
        }),
      );
    });

    it('should include details metadata and changes if requested', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);

      await repository.queryAuditLogs(mockSuperUser, { includeDetails: true });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            metadata: true,
            changes: true,
          }),
        }),
      );
    });
  });

  describe('getAuditSummary', () => {
    it('should execute counts and grouping by module, action, severity and status', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(10);
      mockPrisma.auditLog.groupBy
        .mockResolvedValueOnce([{ module: 'ADMISSIONS', _count: { _all: 6 } }]) // byModule
        .mockResolvedValueOnce([{ action: 'CREATE', _count: { _all: 5 } }]) // byAction
        .mockResolvedValueOnce([{ severity: 'INFO', _count: { _all: 9 } }]) // bySeverity
        .mockResolvedValueOnce([{ status: 'SUCCESS', _count: { _all: 10 } }]); // byStatus

      const summary = await repository.getAuditSummary(
        { role: 'SUPER_ADMIN' },
        {},
      );

      expect(summary.totalCount).toBe(10);
      expect(summary.byModule).toContainEqual({
        module: 'ADMISSIONS',
        count: 6,
      });
      expect(summary.byAction).toContainEqual({ action: 'CREATE', count: 5 });
      expect(summary.bySeverity).toContainEqual({ severity: 'INFO', count: 9 });
      expect(summary.byStatus).toContainEqual({ status: 'SUCCESS', count: 10 });
    });
  });

  describe('getAuditTimeline', () => {
    it('should generate daily activity mapping and return chronological events', async () => {
      const log1 = { timestamp: new Date('2026-07-25T10:00:00Z') };
      const log2 = { timestamp: new Date('2026-07-25T14:30:00Z') };
      const log3 = { timestamp: new Date('2026-07-26T09:15:00Z') };

      mockPrisma.auditLog.findMany
        .mockResolvedValueOnce([log1, log2, log3]) // first call: select timestamps
        .mockResolvedValueOnce([{ id: 'log-1', eventName: 'login' }]); // second call: recent events

      const timeline = await repository.getAuditTimeline(
        { role: 'SUPER_ADMIN' },
        {},
      );

      expect(timeline.dailyActivity).toEqual([
        { date: '2026-07-25', count: 2 },
        { date: '2026-07-26', count: 1 },
      ]);
      expect(timeline.events).toHaveLength(1);
      expect(timeline.events[0].id).toBe('log-1');
    });
  });

  describe('getAuditLogById details access control', () => {
    const logData = {
      id: 'log-id',
      organizationId: 'org-abc',
      branchId: 'branch-xyz',
      userId: 'user-staff',
    };

    it('SUPER_ADMIN should be granted access to any log', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValueOnce(logData);
      const res = await repository.getAuditLogById(
        { role: 'SUPER_ADMIN' },
        'log-id',
      );
      expect(res).toEqual(logData);
    });

    it('ORG_ADMIN should be granted access if organizationId matches', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValueOnce(logData);
      const res = await repository.getAuditLogById(
        { role: 'ORG_ADMIN', organizationId: 'org-abc' },
        'log-id',
      );
      expect(res).toEqual(logData);
    });

    it('ORG_ADMIN should be denied access if organizationId mismatches', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValueOnce(logData);
      const res = await repository.getAuditLogById(
        { role: 'ORG_ADMIN', organizationId: 'other-org' },
        'log-id',
      );
      expect(res).toBe('FORBIDDEN');
    });

    it('BRANCH_ADMIN should be granted access if branchId matches', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValueOnce(logData);
      const res = await repository.getAuditLogById(
        { role: 'BRANCH_ADMIN', branchId: 'branch-xyz' },
        'log-id',
      );
      expect(res).toEqual(logData);
    });

    it('BRANCH_ADMIN should be denied access if branchId mismatches', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValueOnce(logData);
      const res = await repository.getAuditLogById(
        { role: 'BRANCH_ADMIN', branchId: 'other-branch' },
        'log-id',
      );
      expect(res).toBe('FORBIDDEN');
    });

    it('STAFF should be granted access to their own log', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValueOnce(logData);
      const res = await repository.getAuditLogById(
        { id: 'user-staff', role: 'STAFF' },
        'log-id',
      );
      expect(res).toEqual(logData);
    });

    it('STAFF should be denied access to another user log', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValueOnce(logData);
      const res = await repository.getAuditLogById(
        { id: 'user-other', role: 'STAFF' },
        'log-id',
      );
      expect(res).toBe('FORBIDDEN');
    });
  });
});
