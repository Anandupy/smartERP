import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationController } from '@/modules/authorization/authorization.controller';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { PermissionCatalogService } from '@/modules/authorization/permission-catalog.service';
import { PermissionAssignmentService } from '@/modules/authorization/permission-assignment.service';
import { RoleType, OverrideType } from '@/generated/client';
import { ForbiddenException } from '@nestjs/common';

describe('AuthorizationController', () => {
  let controller: AuthorizationController;

  const mockAuthorizationService = {
    getUserEffectivePermissions: jest.fn(),
  };

  const mockCatalogService = {
    getCategories: jest.fn(),
    getPermissions: jest.fn(),
    getPermissionById: jest.fn(),
  };

  const mockAssignmentService = {
    getRolePermissions: jest.fn(),
    assignPermissionsToRole: jest.fn(),
    getUserOverrides: jest.fn(),
    setUserOverride: jest.fn(),
    removeUserOverride: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthorizationController],
      providers: [
        { provide: AuthorizationService, useValue: mockAuthorizationService },
        { provide: PermissionCatalogService, useValue: mockCatalogService },
        { provide: PermissionAssignmentService, useValue: mockAssignmentService },
      ],
    }).compile();

    controller = module.get<AuthorizationController>(AuthorizationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list categories', async () => {
    mockCatalogService.getCategories.mockResolvedValue([
      { id: 'cat-1', code: 'STUDENTS', name: 'Students' },
    ]);

    const res = await controller.getCategories();
    expect(res.length).toBe(1);
    expect(mockCatalogService.getCategories).toHaveBeenCalled();
  });

  it('should list permissions with query filters', async () => {
    mockCatalogService.getPermissions.mockResolvedValue([
      { id: 'perm-1', name: 'student.view' },
    ]);

    const res = await controller.getPermissions({ categoryId: 'cat-1' });
    expect(res.length).toBe(1);
    expect(mockCatalogService.getPermissions).toHaveBeenCalledWith('cat-1');
  });

  it('should assign role permissions using PermissionAssignmentService', async () => {
    mockAssignmentService.assignPermissionsToRole.mockResolvedValue({
      role: RoleType.STAFF,
      count: 1,
    });

    const req = { context: { userId: 'admin-1' } };
    const res = await controller.assignRolePermissions(
      RoleType.STAFF,
      { permissionIds: ['019183ab-1234-7111-a111-111111111111'] },
      req,
    );

    expect(res.count).toBe(1);
    expect(mockAssignmentService.assignPermissionsToRole).toHaveBeenCalled();
  });

  it('should return active user effective permissions for /me/effective-permissions', async () => {
    mockAuthorizationService.getUserEffectivePermissions.mockResolvedValue({
      userId: 'user-1',
      role: RoleType.STAFF,
      effectivePermissions: ['student.view'],
    });

    const req = { user: { id: 'user-1', role: RoleType.STAFF } };
    const res = await controller.getMyEffectivePermissions(req);

    expect(res.userId).toBe('user-1');
    expect(res.effectivePermissions).toEqual(['student.view']);
  });

  it('should throw ForbiddenException for /me/effective-permissions if unauthenticated', async () => {
    const req = {};
    await expect(controller.getMyEffectivePermissions(req)).rejects.toThrow(ForbiddenException);
  });
});
