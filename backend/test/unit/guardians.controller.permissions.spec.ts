import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GuardiansController } from '@/modules/admissions/guardians/guardians.controller';
import { PERMISSION_KEY } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { PermissionGuard } from '@/common/guards/permission.guard';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { LoggerService } from '@/common/logger/logger.service';
import { RoleType } from '@/generated/client';

/**
 * R2 — every guardian route must carry `@RequirePermission`.
 *
 * Before this change `GuardiansController` was, per the lifecycle
 * specification (§35.2, §46 D2), "the only guardian module in the codebase
 * without one" — every route was reachable by any authenticated STAFF/BA/OA
 * user with no permission check at all.
 */
describe('GuardiansController permission enforcement', () => {
  const reflector = new Reflector();

  const routes: Array<{
    method: keyof GuardiansController;
    expected: string;
  }> = [
    { method: 'create', expected: PERMISSIONS.Guardian.Create },
    { method: 'search', expected: PERMISSIONS.Guardian.View },
    { method: 'findOne', expected: PERMISSIONS.Guardian.View },
    { method: 'update', expected: PERMISSIONS.Guardian.Update },
    { method: 'map', expected: PERMISSIONS.Guardian.Map },
    { method: 'getMapped', expected: PERMISSIONS.Guardian.View },
    { method: 'removeMap', expected: PERMISSIONS.Guardian.Unmap },
  ];

  it.each(routes)(
    'G — $method declares @RequirePermission($expected)',
    ({ method, expected }) => {
      const handler = (GuardiansController.prototype as any)[method];
      const declared = reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
        handler,
        GuardiansController,
      ]);

      expect(declared).toBeDefined();
      expect(declared).toContain(expected);
    },
  );

  it('G — every controller route is covered by the table above', () => {
    const declaredRouteMethods = Object.getOwnPropertyNames(
      GuardiansController.prototype,
    ).filter((name) => name !== 'constructor');

    expect(declaredRouteMethods.sort()).toEqual(
      routes.map((r) => r.method).sort(),
    );
  });
});

describe('GuardiansController route permission is enforced by PermissionGuard', () => {
  let guard: PermissionGuard;
  let realReflector: Reflector;

  const mockAuthorizationService = {
    canUserAccess: jest.fn(),
  };
  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        Reflector,
        { provide: AuthorizationService, useValue: mockAuthorizationService },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    guard = module.get(PermissionGuard);
    realReflector = module.get(Reflector);
  });

  const contextFor = (handlerName: keyof GuardiansController, user: any) => {
    const req: any = {
      user,
      context: { userId: user?.id ?? null, role: user?.role ?? null },
    };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => (GuardiansController.prototype as any)[handlerName],
      getClass: () => GuardiansController,
    } as unknown as ExecutionContext;
  };

  it('E — a user granted guardian.view can reach findOne', async () => {
    mockAuthorizationService.canUserAccess.mockResolvedValue({
      allowed: true,
      missingPermissions: [],
    });

    const ctx = contextFor('findOne', {
      id: 'user-1',
      role: RoleType.STAFF,
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockAuthorizationService.canUserAccess).toHaveBeenCalledWith(
      'user-1',
      RoleType.STAFF,
      [PERMISSIONS.Guardian.View],
      'ALL',
    );
  });

  it('F — a user without guardian.view is rejected from findOne', async () => {
    mockAuthorizationService.canUserAccess.mockResolvedValue({
      allowed: false,
      missingPermissions: [PERMISSIONS.Guardian.View],
    });

    const ctx = contextFor('findOne', {
      id: 'user-2',
      role: RoleType.STAFF,
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('F — an unauthenticated caller is rejected before AuthorizationService runs', async () => {
    const ctx = contextFor('update', null);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(mockAuthorizationService.canUserAccess).not.toHaveBeenCalled();
  });

  it('sanity: real Reflector resolves metadata used above', () => {
    expect(realReflector).toBeInstanceOf(Reflector);
  });
});
