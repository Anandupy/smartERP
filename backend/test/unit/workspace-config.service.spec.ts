import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceConfigService } from '@/modules/workspace/services/workspace-config.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { LoggerService } from '@/common/logger/logger.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import { WorkspaceScopeType } from '@/generated/client';
import { WorkspaceConfigurationUpdatedEvent } from '@/common/events/workspace.events';

describe('WorkspaceConfigService', () => {
  let service: WorkspaceConfigService;

  const mockPrisma: any = {
    workspaceConfiguration: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockEventBus = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockRequestContext = {
    getContext: jest.fn().mockReturnValue({
      userId: 'user-admin-1',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceConfigService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
        { provide: LoggerService, useValue: mockLogger },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    service = module.get<WorkspaceConfigService>(WorkspaceConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should resolve layered configuration with deterministic inheritance overrides', async () => {
    // Mock 3 layers: PRODUCT -> BRANCH -> USER
    mockPrisma.workspaceConfiguration.findMany.mockResolvedValue([
      {
        scopeType: WorkspaceScopeType.PRODUCT,
        scopeId: null,
        navigationPreferences: { sidebarCollapsed: false, themeMode: 'light' },
        clientPreferences: { theme: 'light', font: 'Inter' },
      },
      {
        scopeType: WorkspaceScopeType.BRANCH,
        scopeId: 'branch-101',
        navigationPreferences: { sidebarCollapsed: true },
        clientPreferences: {},
      },
      {
        scopeType: WorkspaceScopeType.USER,
        scopeId: 'user-1',
        navigationPreferences: { themeMode: 'dark' },
        clientPreferences: { font: 'Roboto' },
      },
    ]);

    const result = await service.resolveConfiguration(
      'org-1',
      'branch-101',
      'STAFF',
      'user-1',
    );

    // User overrides themeMode & font, Branch overrides sidebarCollapsed
    expect(result.navigationPreferences.sidebarCollapsed).toBe(true);
    expect(result.navigationPreferences.themeMode).toBe('dark');
    expect(result.clientPreferences.font).toBe('Roboto');
  });

  it('should upsert workspace configuration layer and publish domain event', async () => {
    mockPrisma.workspaceConfiguration.findFirst.mockResolvedValue(null);
    mockPrisma.workspaceConfiguration.create.mockResolvedValue({
      id: 'cfg-100',
      scopeType: WorkspaceScopeType.ROLE,
      scopeId: 'STAFF',
      navigationPreferences: { denseMode: true },
      clientPreferences: {},
    });

    const result = await service.upsertConfiguration(
      WorkspaceScopeType.ROLE,
      'STAFF',
      { denseMode: true },
    );

    expect(result.id).toBe('cfg-100');
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(WorkspaceConfigurationUpdatedEvent),
    );
  });
});
