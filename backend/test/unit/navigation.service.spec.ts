import { Test, TestingModule } from '@nestjs/testing';
import { NavigationService } from '@/modules/workspace/navigation/services/navigation.service';
import { NavigationTreeBuilder } from '@/modules/workspace/navigation/builders/navigation-tree.builder';
import { NavigationCacheService } from '@/modules/workspace/navigation/services/navigation-cache.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { LoggerService } from '@/common/logger/logger.service';
import { MenuStatus, RoleType } from '@/generated/client';

describe('NavigationService', () => {
  let service: NavigationService;

  const mockPrisma: any = {
    module: {
      findMany: jest.fn(),
    },
    menu: {
      findMany: jest.fn(),
    },
  };

  const mockAuthorizationService = {
    canUserAccess: jest.fn(),
  };

  const mockCacheService = {
    getUserNavigation: jest.fn().mockResolvedValue(null),
    setUserNavigation: jest.fn().mockResolvedValue(undefined),
  };

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NavigationService,
        NavigationTreeBuilder,
        { provide: NavigationCacheService, useValue: mockCacheService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthorizationService, useValue: mockAuthorizationService },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<NavigationService>(NavigationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should resolve navigation tree by applying module enablement, menu status, and authorization platform checks', async () => {
    mockPrisma.module.findMany.mockResolvedValue([
      { id: 'mod-adm', code: 'ADMISSIONS' },
      { id: 'mod-set', code: 'SETTINGS' },
    ]);

    mockPrisma.menu.findMany.mockResolvedValue([
      {
        id: 'menu-1',
        code: 'ADMISSIONS_APPLICANTS',
        moduleId: 'mod-adm',
        parentId: null,
        route: '/admissions/applicants',
        displayName: 'Applicants',
        permissions: ['admissions.view'],
        permissionMode: 'ALL',
        status: MenuStatus.ACTIVE,
        displayOrder: 1,
      },
      {
        id: 'menu-2',
        code: 'ADMISSIONS_REGISTER',
        moduleId: 'mod-adm',
        parentId: 'menu-1',
        route: '/admissions/applicants/new',
        displayName: 'Register Applicant',
        permissions: ['admissions.create'],
        permissionMode: 'ALL',
        status: MenuStatus.ACTIVE,
        displayOrder: 2,
      },
      {
        id: 'menu-3',
        code: 'SETTINGS_ADVANCED',
        moduleId: 'mod-set',
        parentId: null,
        route: '/settings/advanced',
        displayName: 'Advanced Settings',
        permissions: ['system.manage'],
        permissionMode: 'ALL',
        status: MenuStatus.ACTIVE,
        displayOrder: 1,
      },
    ]);

    mockAuthorizationService.canUserAccess.mockImplementation(
      async (userId, role, permissions) => {
        if (permissions.includes('system.manage')) {
          return { allowed: false, missingPermissions: ['system.manage'] };
        }
        return { allowed: true, missingPermissions: [] };
      },
    );

    const result = await service.resolveUserNavigation(
      'user-staff-1',
      RoleType.STAFF,
    );

    expect(result.tree).toHaveLength(1);
    expect(result.tree[0].id).toBe('menu-1');
    expect(result.tree[0].children).toHaveLength(1);
    expect(result.tree[0].children[0].id).toBe('menu-2');
  });
});
