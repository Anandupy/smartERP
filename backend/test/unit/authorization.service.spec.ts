import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { PermissionResolverService } from '@/modules/authorization/permission-resolver.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { LoggerService } from '@/common/logger/logger.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import { RoleType } from '@/generated/client';

describe('AuthorizationService Façade', () => {
  let service: AuthorizationService;

  const mockResolver = {
    resolvePermissions: jest.fn(),
  };

  const mockEventBus = {
    publish: jest.fn(),
    subscribe: jest.fn(),
  };

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockRequestContextService = {
    getContext: jest.fn().mockReturnValue({
      userId: 'user-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorizationService,
        { provide: PermissionResolverService, useValue: mockResolver },
        { provide: EventBus, useValue: mockEventBus },
        { provide: LoggerService, useValue: mockLogger },
        { provide: RequestContextService, useValue: mockRequestContextService },
      ],
    }).compile();

    service = module.get<AuthorizationService>(AuthorizationService);
  });

  it('should evaluate hasPermission correctly', async () => {
    mockResolver.resolvePermissions.mockResolvedValue({
      effectivePermissions: new Set(['student.view']),
    });

    const hasView = await service.hasPermission('user-1', RoleType.STAFF, 'student.view');
    const hasCreate = await service.hasPermission('user-1', RoleType.STAFF, 'student.create');

    expect(hasView).toBe(true);
    expect(hasCreate).toBe(false);
  });

  it('should evaluate hasAnyPermission correctly', async () => {
    mockResolver.resolvePermissions.mockResolvedValue({
      effectivePermissions: new Set(['student.view']),
    });

    const res1 = await service.hasAnyPermission('user-1', RoleType.STAFF, ['student.view', 'student.create']);
    const res2 = await service.hasAnyPermission('user-1', RoleType.STAFF, ['fees.collect']);

    expect(res1).toBe(true);
    expect(res2).toBe(false);
  });

  it('should evaluate hasAllPermissions correctly', async () => {
    mockResolver.resolvePermissions.mockResolvedValue({
      effectivePermissions: new Set(['student.view', 'student.create']),
    });

    const res1 = await service.hasAllPermissions('user-1', RoleType.STAFF, ['student.view', 'student.create']);
    const res2 = await service.hasAllPermissions('user-1', RoleType.STAFF, ['student.view', 'student.delete']);

    expect(res1).toBe(true);
    expect(res2).toBe(false);
  });

  it('should grant access in canUserAccess if all permissions present', async () => {
    mockResolver.resolvePermissions.mockResolvedValue({
      effectivePermissions: new Set(['student.view', 'student.create']),
    });

    const res = await service.canUserAccess('user-1', RoleType.STAFF, ['student.view', 'student.create'], 'ALL');

    expect(res.allowed).toBe(true);
    expect(res.missingPermissions).toEqual([]);
  });

  it('should deny access and emit PermissionDeniedEvent if permission missing', async () => {
    mockResolver.resolvePermissions.mockResolvedValue({
      effectivePermissions: new Set(['student.view']),
    });

    const res = await service.canUserAccess(
      'user-1',
      RoleType.STAFF,
      ['student.view', 'student.delete'],
      'ALL',
      { route: '/admissions/applicants/1', httpMethod: 'DELETE' },
    );

    expect(res.allowed).toBe(false);
    expect(res.missingPermissions).toEqual(['student.delete']);
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should return user effective permissions', async () => {
    mockResolver.resolvePermissions.mockResolvedValue({
      userId: 'user-1',
      role: RoleType.STAFF,
      effectivePermissions: new Set(['student.view']),
      rolePermissions: ['student.view'],
      userGrants: [],
      userDenies: [],
      isSuperAdmin: false,
      resolutionDurationMs: 2.5,
    });

    const res = await service.getUserEffectivePermissions('user-1', RoleType.STAFF);

    expect(res.userId).toBe('user-1');
    expect(res.effectivePermissions).toEqual(['student.view']);
    expect(res.resolutionDurationMs).toBe(2.5);
  });
});
