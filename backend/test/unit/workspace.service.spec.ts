import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from '@/modules/workspace/workspace.service';
import { NavigationService } from '@/modules/workspace/navigation/services/navigation.service';
import { WorkspaceConfigService } from '@/modules/workspace/configuration/workspace-config.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import { LoggerService } from '@/common/logger/logger.service';
import { RoleType } from '@/generated/client';
import { UnauthorizedException } from '@nestjs/common';

describe('WorkspaceService Façade Orchestrator', () => {
  let service: WorkspaceService;

  const mockNavigationService = {
    resolveUserNavigation: jest.fn(),
  };

  const mockConfigService = {
    resolveConfiguration: jest.fn(),
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
      organizationId: 'org-100',
      branchId: 'branch-200',
      academicYearId: 'ay-300',
      clientApp: 'campusflow-web',
      clientVersion: '1.0.0',
      platform: 'WEB',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: NavigationService, useValue: mockNavigationService },
        { provide: WorkspaceConfigService, useValue: mockConfigService },
        { provide: RequestContextService, useValue: mockRequestContext },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should orchestrate workspace layout response containing activeContexts, client, configuration, navigation, and metadata', async () => {
    mockConfigService.resolveConfiguration.mockResolvedValue({
      navigationPreferences: { sidebarCollapsed: false },
      clientPreferences: { theme: 'system' },
    });

    mockNavigationService.resolveUserNavigation.mockResolvedValue({
      tree: [
        {
          id: 'menu-1',
          code: 'ADMISSIONS',
          displayName: 'Admissions',
          children: [
            {
              id: 'menu-2',
              code: 'APPLICANTS',
              displayName: 'Applicants List',
              children: [],
            },
          ],
        },
      ],
      totalVisibleMenus: 2,
      menuTreeDepth: 2,
    });

    const result = await service.getWorkspaceLayout(
      'user-staff-1',
      RoleType.STAFF,
    );

    expect(result.activeContexts.organizationId).toBe('org-100');
    expect(result.activeContexts.branchId).toBe('branch-200');
    expect(result.activeContexts.academicYearId).toBe('ay-300');
    expect(result.client.platform).toBe('WEB');
    expect(result.configuration.navigationPreferences.sidebarCollapsed).toBe(
      false,
    );
    expect(result.navigation).toHaveLength(1);
    expect(result.metadata.totalVisibleMenus).toBe(2);
    expect(result.metadata.menuTreeDepth).toBe(2);
    expect(typeof result.metadata.resolvedAt).toBe('string');
  });

  it('should throw UnauthorizedException if user context is missing', async () => {
    await expect(service.getWorkspaceLayout('', '' as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
