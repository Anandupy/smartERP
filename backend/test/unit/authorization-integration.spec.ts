import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionGuard } from '@/common/guards/permission.guard';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { PermissionResolverService } from '@/modules/authorization/permission-resolver.service';
import { PermissionCatalogService } from '@/modules/authorization/permission-catalog.service';
import { PermissionAssignmentService } from '@/modules/authorization/permission-assignment.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { EventsModule } from '@/infrastructure/events/events.module';
import { LoggerService } from '@/common/logger/logger.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import { AuditEventMapper } from '@/infrastructure/audit/audit-event.mapper';
import { AuditListener } from '@/infrastructure/audit/audit.listener';
import { AuditRepository } from '@/infrastructure/audit/audit.repository';
import { RoleType, OverrideType } from '@/generated/client';
import { PERMISSIONS } from '@/common/constants/permission.constants';

describe('Authorization Platform Phase 3 Integration Test', () => {
  let guard: PermissionGuard;
  let eventBus: EventBus;
  let auditRepository: AuditRepository;

  const mockPrisma: any = {
    userPermissionOverride: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    rolePermission: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    permissionCategory: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockRequestContextService = {
    getContext: jest.fn().mockReturnValue({
      requestId: 'req-test-123',
      userId: 'user-staff-1',
      role: RoleType.STAFF,
      organizationId: 'org-100',
      branchId: 'branch-200',
      academicYearId: 'ay-300',
    }),
  };

  const createMockContext = (
    user: any = { id: 'user-staff-1', role: RoleType.STAFF },
    route = '/admissions/applicants',
    httpMethod = 'POST',
  ) => {
    const req: any = {
      user,
      path: route,
      method: httpMethod,
      context: {
        requestId: 'req-test-123',
        userId: user?.id || null,
        role: user?.role || null,
        organizationId: 'org-100',
        branchId: 'branch-200',
        academicYearId: 'ay-300',
      },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [EventsModule],
      providers: [
        PermissionGuard,
        AuthorizationService,
        PermissionResolverService,
        PermissionCatalogService,
        PermissionAssignmentService,
        { provide: Reflector, useValue: mockReflector },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
        { provide: RequestContextService, useValue: mockRequestContextService },
        AuditEventMapper,
        AuditListener,
        {
          provide: AuditRepository,
          useValue: {
            createAuditLog: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
          },
        },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
    eventBus = module.get<EventBus>(EventBus);
    auditRepository = module.get<AuditRepository>(AuditRepository);

    // Initialize AuditListener subscribers
    const auditListener = module.get<AuditListener>(AuditListener);
    auditListener.onModuleInit();
  });

  it('should grant access to STAFF user with required permission', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'permissions') return [PERMISSIONS.Admissions.View];
      if (key === 'permission_mode') return 'ALL';
      return null;
    });

    mockPrisma.userPermissionOverride.findMany.mockResolvedValue([]);
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permission: { name: PERMISSIONS.Admissions.View, isActive: true } },
    ]);

    const ctx = createMockContext();
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(auditRepository.createAuditLog).not.toHaveBeenCalled();
  });

  it('should deny access, throw ForbiddenException, and persist security audit log on missing permission', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'permissions') return [PERMISSIONS.Admissions.Delete];
      if (key === 'permission_mode') return 'ALL';
      return null;
    });

    mockPrisma.userPermissionOverride.findMany.mockResolvedValue([]);
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permission: { name: PERMISSIONS.Admissions.View, isActive: true } },
    ]);

    const ctx = createMockContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);

    // Short delay to allow async EventBus handler execution
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(auditRepository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'authorization.permission_denied',
        action: 'EXECUTE',
        module: 'AUTHORIZATION',
        severity: 'WARNING',
        status: 'FAILED',
        userId: 'user-staff-1',
        organizationId: 'org-100',
        branchId: 'branch-200',
      }),
    );
  });

  it('should override role permission with User DENY override and deny access', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'permissions') return [PERMISSIONS.Admissions.View];
      return null;
    });

    mockPrisma.userPermissionOverride.findMany.mockResolvedValue([
      {
        type: OverrideType.DENY,
        permission: { name: PERMISSIONS.Admissions.View, isActive: true },
      },
    ]);
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permission: { name: PERMISSIONS.Admissions.View, isActive: true } },
    ]);

    const ctx = createMockContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should override missing role permission with User GRANT override and allow access', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'permissions') return [PERMISSIONS.Fees.Collect];
      return null;
    });

    mockPrisma.userPermissionOverride.findMany.mockResolvedValue([
      {
        type: OverrideType.GRANT,
        permission: { name: PERMISSIONS.Fees.Collect, isActive: true },
      },
    ]);
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permission: { name: PERMISSIONS.Admissions.View, isActive: true } },
    ]);

    const ctx = createMockContext();
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should automatically grant full access for SUPER_ADMIN role', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'permissions') return [PERMISSIONS.System.Manage];
      return null;
    });

    mockPrisma.userPermissionOverride.findMany.mockResolvedValue([]);
    mockPrisma.permission.findMany.mockResolvedValue([
      { name: PERMISSIONS.System.Manage },
    ]);

    const ctx = createMockContext({
      id: 'superadmin-1',
      role: RoleType.SUPER_ADMIN,
    });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should support ANY permission mode', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'permissions')
        return [PERMISSIONS.Admissions.View, PERMISSIONS.Admissions.Delete];
      if (key === 'permission_mode') return 'ANY';
      return null;
    });

    mockPrisma.userPermissionOverride.findMany.mockResolvedValue([]);
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permission: { name: PERMISSIONS.Admissions.View, isActive: true } },
    ]);

    const ctx = createMockContext();
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });
});
