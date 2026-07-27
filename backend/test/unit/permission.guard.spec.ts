import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { PermissionGuard } from '@/common/guards/permission.guard';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { LoggerService } from '@/common/logger/logger.service';
import { RoleType } from '@/generated/client';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;
  let authorizationService: AuthorizationService;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockAuthorizationService = {
    canUserAccess: jest.fn(),
  };

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const createMockContext = (user: any = null, contextData: any = {}) => {
    const req: any = {
      user,
      context: {
        userId: user?.id || null,
        role: user?.role || null,
        ...contextData,
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
      providers: [
        PermissionGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: AuthorizationService, useValue: mockAuthorizationService },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
    reflector = module.get<Reflector>(Reflector);
    authorizationService = module.get<AuthorizationService>(AuthorizationService);
  });

  it('should pass through if no permissions metadata required', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(null);
    const ctx = createMockContext();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockAuthorizationService.canUserAccess).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException if user is not authenticated', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'permissions') return ['student.view'];
      return null;
    });

    const ctx = createMockContext(null);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should call AuthorizationService and allow access if authorized', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'permissions') return ['student.view'];
      if (key === 'permission_mode') return 'ALL';
      return null;
    });

    mockAuthorizationService.canUserAccess.mockResolvedValue({
      allowed: true,
      missingPermissions: [],
    });

    const ctx = createMockContext({ id: 'user-1', role: RoleType.STAFF });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockAuthorizationService.canUserAccess).toHaveBeenCalledWith(
      'user-1',
      RoleType.STAFF,
      ['student.view'],
      'ALL',
    );
  });

  it('should throw ForbiddenException if AuthorizationService denies access', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'permissions') return ['student.delete'];
      return null;
    });

    mockAuthorizationService.canUserAccess.mockResolvedValue({
      allowed: false,
      missingPermissions: ['student.delete'],
    });

    const ctx = createMockContext({ id: 'user-1', role: RoleType.STAFF });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
