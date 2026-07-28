import { Test, TestingModule } from '@nestjs/testing';
import { NavigationService } from '@/modules/workspace/services/navigation.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { LoggerService } from '@/common/logger/logger.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import { MenuStatus, RoleType } from '@/generated/client';
import {
  ModuleCreatedEvent,
  MenuCreatedEvent,
} from '@/modules/workspace/events/workspace.events';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('NavigationService', () => {
  let service: NavigationService;

  const mockPrisma: any = {
    module: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    menu: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockAuthorizationService = {
    canUserAccess: jest.fn(),
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
    getContext: jest.fn().mockReturnValue({ userId: 'user-admin-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NavigationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthorizationService, useValue: mockAuthorizationService },
        { provide: EventBus, useValue: mockEventBus },
        { provide: LoggerService, useValue: mockLogger },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    service = module.get<NavigationService>(NavigationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should resolve navigation tree by applying module enablement, menu status, and authorization platform checks', async () => {
    // 1. Mock Active Modules
    mockPrisma.module.findMany.mockResolvedValue([
      { id: 'mod-adm', code: 'ADMISSIONS' },
      { id: 'mod-set', code: 'SETTINGS' },
    ]);

    // 2. Mock Menus (Parent + Child)
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

    // Mock Authorization Platform response: STAFF has admissions.view & admissions.create, but NOT system.manage
    mockAuthorizationService.canUserAccess.mockImplementation(
      async (userId, role, permissions, mode) => {
        if (permissions.includes('system.manage')) {
          return { allowed: false, missingPermissions: ['system.manage'] };
        }
        return { allowed: true, missingPermissions: [] };
      },
    );

    const tree = await service.resolveUserNavigationTree('user-staff-1', RoleType.STAFF);

    // Expect menu-3 to be filtered out by Authorization Platform
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('menu-1');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('menu-2');
  });

  it('should exclude menus when parent module is disabled', async () => {
    // Only SETTINGS module is active; ADMISSIONS module is disabled
    mockPrisma.module.findMany.mockResolvedValue([
      { id: 'mod-set', code: 'SETTINGS' },
    ]);

    mockPrisma.menu.findMany.mockResolvedValue([
      {
        id: 'menu-set',
        code: 'SETTINGS_GENERAL',
        moduleId: 'mod-set',
        parentId: null,
        route: '/settings/general',
        displayName: 'General Settings',
        permissions: [],
        status: MenuStatus.ACTIVE,
        displayOrder: 1,
      },
    ]);

    const tree = await service.resolveUserNavigationTree('user-staff-1', RoleType.STAFF);

    expect(tree).toHaveLength(1);
    expect(tree[0].code).toBe('SETTINGS_GENERAL');
  });

  it('should support ANY permission evaluation mode', async () => {
    mockPrisma.module.findMany.mockResolvedValue([
      { id: 'mod-adm', code: 'ADMISSIONS' },
    ]);

    mockPrisma.menu.findMany.mockResolvedValue([
      {
        id: 'menu-dashboard',
        code: 'ADMISSIONS_DASHBOARD',
        moduleId: 'mod-adm',
        parentId: null,
        route: '/admissions/dashboard',
        displayName: 'Dashboard',
        permissions: ['admissions.view', 'student.view'],
        permissionMode: 'ANY',
        status: MenuStatus.ACTIVE,
        displayOrder: 1,
      },
    ]);

    mockAuthorizationService.canUserAccess.mockResolvedValue({
      allowed: true,
      missingPermissions: [],
    });

    const tree = await service.resolveUserNavigationTree('user-staff-1', RoleType.STAFF);

    expect(tree).toHaveLength(1);
    expect(mockAuthorizationService.canUserAccess).toHaveBeenCalledWith(
      'user-staff-1',
      RoleType.STAFF,
      ['admissions.view', 'student.view'],
      'ANY',
    );
  });

  it('should create navigation module and publish event', async () => {
    mockPrisma.module.findUnique.mockResolvedValue(null);
    mockPrisma.module.create.mockResolvedValue({
      id: 'mod-100',
      code: 'HOSTEL',
      name: 'Hostel',
    });

    const result = await service.createModule({ code: 'HOSTEL', name: 'Hostel' });

    expect(result.id).toBe('mod-100');
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(ModuleCreatedEvent),
    );
  });

  it('should create navigation menu and publish event', async () => {
    mockPrisma.menu.findUnique.mockResolvedValue(null);
    mockPrisma.menu.create.mockResolvedValue({
      id: 'menu-100',
      code: 'HOSTEL_ROOMS',
      displayName: 'Rooms',
      route: '/hostel/rooms',
    });

    const result = await service.createMenu({
      code: 'HOSTEL_ROOMS',
      moduleId: 'mod-100',
      route: '/hostel/rooms',
      displayName: 'Rooms',
    });

    expect(result.id).toBe('menu-100');
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(MenuCreatedEvent),
    );
  });
});
