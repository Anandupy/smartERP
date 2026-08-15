import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ReligionController } from '@/modules/admissions/masters/religion/religion.controller';
import { CasteController } from '@/modules/admissions/masters/caste/caste.controller';
import { CategoryController } from '@/modules/admissions/masters/category/category.controller';
import { GenderController } from '@/modules/admissions/masters/gender/gender.controller';
import { BloodGroupController } from '@/modules/admissions/masters/blood-group/blood-group.controller';
import { LanguageController } from '@/modules/admissions/masters/language/language.controller';
import { DisabilityController } from '@/modules/admissions/masters/disability/disability.controller';
import { RelationTypeController } from '@/modules/admissions/masters/relation-type/relation-type.controller';
import { QuotaController } from '@/modules/admissions/masters/quota/quota.controller';
import { AdmissionSourceController } from '@/modules/admissions/masters/admission-source/admission-source.controller';
import { PERMISSION_KEY } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { PermissionGuard } from '@/common/guards/permission.guard';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { LoggerService } from '@/common/logger/logger.service';
import { RoleType } from '@/generated/client';

/**
 * R3 — every admissions master route must carry `@RequirePermission`.
 *
 * Before this change every master controller (Religion, Caste, Category,
 * Gender, BloodGroup, Language, Disability, RelationType, Quota,
 * AdmissionSource) relied solely on `@Roles()`. `PermissionGuard` passes a
 * route through untouched when no `@RequirePermission` metadata is present,
 * so these routes carried no fine-grained authorization at all — unlike
 * every sibling admissions controller (Applicant, Admission, Guardian).
 */
const routes: Array<{
  method: 'create' | 'findAll' | 'findOne' | 'update' | 'remove';
  expected: string;
}> = [
  { method: 'create', expected: PERMISSIONS.AdmissionsMasters.Create },
  { method: 'findAll', expected: PERMISSIONS.AdmissionsMasters.View },
  { method: 'findOne', expected: PERMISSIONS.AdmissionsMasters.View },
  { method: 'update', expected: PERMISSIONS.AdmissionsMasters.Update },
  { method: 'remove', expected: PERMISSIONS.AdmissionsMasters.Delete },
];

const controllers = [
  ReligionController,
  CasteController,
  CategoryController,
  GenderController,
  BloodGroupController,
  LanguageController,
  DisabilityController,
  RelationTypeController,
  QuotaController,
  AdmissionSourceController,
];

describe('Admissions Masters controllers permission enforcement', () => {
  const reflector = new Reflector();

  describe.each(controllers)('$name', (Controller) => {
    it.each(routes)(
      'declares @RequirePermission($expected) on $method',
      ({ method, expected }) => {
        const handler = (Controller.prototype as any)[method];
        const declared = reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
          handler,
          Controller,
        ]);

        expect(declared).toBeDefined();
        expect(declared).toContain(expected);
      },
    );

    it('every declared route is covered by the table above', () => {
      const declaredRouteMethods = Object.getOwnPropertyNames(
        Controller.prototype,
      ).filter((name) => name !== 'constructor');

      expect(declaredRouteMethods.sort()).toEqual(
        routes.map((r) => r.method).sort(),
      );
    });
  });
});

describe('PermissionGuard enforces admissions.masters.* on a representative controller', () => {
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

  const contextFor = (handlerName: string, user: any) => {
    const req: any = {
      user,
      context: { userId: user?.id ?? null, role: user?.role ?? null },
    };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => (ReligionController.prototype as any)[handlerName],
      getClass: () => ReligionController,
    } as unknown as ExecutionContext;
  };

  it('allows a caller granted admissions.masters.view to reach findOne', async () => {
    mockAuthorizationService.canUserAccess.mockResolvedValue({
      allowed: true,
      missingPermissions: [],
    });

    const ctx = contextFor('findOne', { id: 'user-1', role: RoleType.STAFF });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockAuthorizationService.canUserAccess).toHaveBeenCalledWith(
      'user-1',
      RoleType.STAFF,
      [PERMISSIONS.AdmissionsMasters.View],
      'ALL',
    );
  });

  it('rejects a caller missing admissions.masters.delete from remove', async () => {
    mockAuthorizationService.canUserAccess.mockResolvedValue({
      allowed: false,
      missingPermissions: [PERMISSIONS.AdmissionsMasters.Delete],
    });

    const ctx = contextFor('remove', { id: 'user-2', role: RoleType.STAFF });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
