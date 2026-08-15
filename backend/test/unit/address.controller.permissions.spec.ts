import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AddressController } from '@/modules/identity/address/address.controller';
import { PERMISSION_KEY } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { PermissionGuard } from '@/common/guards/permission.guard';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { LoggerService } from '@/common/logger/logger.service';
import { RoleType } from '@/generated/client';

/**
 * R4 — every address route must carry `@RequirePermission`, matching the
 * pattern R2 established for Guardian and R3 established for Masters.
 */
const routes: Array<{
  method: 'attach' | 'list' | 'resolve';
  expected: string;
}> = [
  { method: 'attach', expected: PERMISSIONS.Person.AttachAddress },
  { method: 'list', expected: PERMISSIONS.Person.View },
  { method: 'resolve', expected: PERMISSIONS.Person.View },
];

describe('AddressController permission enforcement', () => {
  const reflector = new Reflector();

  it.each(routes)(
    '$method declares @RequirePermission($expected)',
    ({ method, expected }) => {
      const handler = (AddressController.prototype as any)[method];
      const declared = reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
        handler,
        AddressController,
      ]);

      expect(declared).toBeDefined();
      expect(declared).toContain(expected);
    },
  );

  it('every controller route is covered by the table above', () => {
    const declaredRouteMethods = Object.getOwnPropertyNames(
      AddressController.prototype,
    ).filter((name) => name !== 'constructor');

    expect(declaredRouteMethods.sort()).toEqual(
      routes.map((r) => r.method).sort(),
    );
  });
});

describe('AddressController route permission is enforced by PermissionGuard', () => {
  let guard: PermissionGuard;

  const mockAuthorizationService = { canUserAccess: jest.fn() };
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
  });

  const contextFor = (handlerName: keyof AddressController, user: any) => {
    const req: any = {
      user,
      context: { userId: user?.id ?? null, role: user?.role ?? null },
    };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => (AddressController.prototype as any)[handlerName],
      getClass: () => AddressController,
    } as unknown as ExecutionContext;
  };

  it('allows a caller granted person.attach_address to attach', async () => {
    mockAuthorizationService.canUserAccess.mockResolvedValue({
      allowed: true,
      missingPermissions: [],
    });

    const ctx = contextFor('attach', { id: 'user-1', role: RoleType.STAFF });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockAuthorizationService.canUserAccess).toHaveBeenCalledWith(
      'user-1',
      RoleType.STAFF,
      [PERMISSIONS.Person.AttachAddress],
      'ALL',
    );
  });

  it('rejects a caller missing person.attach_address from attach', async () => {
    mockAuthorizationService.canUserAccess.mockResolvedValue({
      allowed: false,
      missingPermissions: [PERMISSIONS.Person.AttachAddress],
    });

    const ctx = contextFor('attach', { id: 'user-2', role: RoleType.STAFF });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
