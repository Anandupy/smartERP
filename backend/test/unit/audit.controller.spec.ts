import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from '@/infrastructure/audit/audit.controller';
import { AuditRepository } from '@/infrastructure/audit/audit.repository';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('AuditController', () => {
  let controller: AuditController;
  let repository: AuditRepository;

  const mockAuditRepository = {
    queryAuditLogs: jest.fn(),
    getAuditSummary: jest.fn(),
    getAuditTimeline: jest.fn(),
    getAuditLogById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        { provide: AuditRepository, useValue: mockAuditRepository },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
    repository = module.get<AuditRepository>(AuditRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should get audit logs', async () => {
    const mockUser = { role: 'SUPER_ADMIN' };
    const mockQuery = { page: 1, limit: 10 };
    mockAuditRepository.queryAuditLogs.mockResolvedValue({ items: [], meta: {} });

    const req = { user: mockUser };
    const res = await controller.getAuditLogs(mockQuery, req);

    expect(res.data).toBeDefined();
    expect(repository.queryAuditLogs).toHaveBeenCalledWith(mockUser, mockQuery);
  });

  it('should get audit summary', async () => {
    const mockUser = { role: 'SUPER_ADMIN' };
    mockAuditRepository.getAuditSummary.mockResolvedValue({});

    const req = { user: mockUser };
    const res = await controller.getAuditSummary({}, req);

    expect(res.data).toBeDefined();
    expect(repository.getAuditSummary).toHaveBeenCalledWith(mockUser, {});
  });

  it('should get audit timeline', async () => {
    const mockUser = { role: 'SUPER_ADMIN' };
    mockAuditRepository.getAuditTimeline.mockResolvedValue({});

    const req = { user: mockUser };
    const res = await controller.getAuditTimeline({}, req);

    expect(res.data).toBeDefined();
    expect(repository.getAuditTimeline).toHaveBeenCalledWith(mockUser, {});
  });

  it('should return log details by ID', async () => {
    const mockUser = { role: 'SUPER_ADMIN' };
    const logDetails = { id: 'log-123', eventName: 'test' };
    mockAuditRepository.getAuditLogById.mockResolvedValue(logDetails);

    const req = { user: mockUser };
    const res = await controller.getAuditLogById('log-123', req);

    expect(res.data).toEqual(logDetails);
  });

  it('should throw NotFoundException if log not found', async () => {
    const mockUser = { role: 'SUPER_ADMIN' };
    mockAuditRepository.getAuditLogById.mockResolvedValue(null);

    const req = { user: mockUser };
    await expect(controller.getAuditLogById('log-123', req)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if access is forbidden', async () => {
    const mockUser = { role: 'STAFF', id: 'user-1' };
    mockAuditRepository.getAuditLogById.mockResolvedValue('FORBIDDEN');

    const req = { user: mockUser };
    await expect(controller.getAuditLogById('log-123', req)).rejects.toThrow(ForbiddenException);
  });
});
