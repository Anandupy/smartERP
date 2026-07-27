import { Test, TestingModule } from '@nestjs/testing';
import { PermissionAssignmentService } from '@/modules/authorization/permission-assignment.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { LoggerService } from '@/common/logger/logger.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import { RoleType, OverrideType } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PermissionAssignmentService', () => {
  let service: PermissionAssignmentService;

  const mockPrisma: any = {
    permission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    rolePermission: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    userPermissionOverride: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
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
      userId: 'admin-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionAssignmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
        { provide: LoggerService, useValue: mockLogger },
        { provide: RequestContextService, useValue: mockRequestContextService },
      ],
    }).compile();

    service = module.get<PermissionAssignmentService>(PermissionAssignmentService);
  });

  it('should list role permissions', async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permission: { id: 'p1', name: 'student.view' } },
    ]);

    const res = await service.getRolePermissions(RoleType.STAFF);
    expect(res.length).toBe(1);
    expect(res[0].name).toBe('student.view');
  });

  it('should assign role permissions and compute added/removed diffs', async () => {
    const p1 = '019183ab-1234-7111-a111-111111111111';
    const p2 = '019183ab-5678-7111-a111-222222222222';

    // Existing: p1 (student.view)
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permissionId: p1, permission: { id: p1, name: 'student.view' } },
    ]);

    // Target: p2 (student.create)
    mockPrisma.permission.findMany.mockResolvedValue([
      { id: p2, name: 'student.create' },
    ]);

    const res = await service.assignPermissionsToRole(RoleType.STAFF, [p2], 'admin-1');

    expect(res.role).toBe(RoleType.STAFF);
    expect(res.count).toBe(1);
    expect(res.addedPermissions).toEqual(['student.create']);
    expect(res.removedPermissions).toEqual(['student.view']);
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should throw BadRequestException if permission IDs are invalid', async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValue([]);
    mockPrisma.permission.findMany.mockResolvedValue([]);

    await expect(
      service.assignPermissionsToRole(RoleType.STAFF, ['invalid-id'], 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should grant user permission override', async () => {
    const p1 = '019183ab-1234-7111-a111-111111111111';
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.permission.findUnique.mockResolvedValue({ id: p1, name: 'fees.collect' });
    mockPrisma.userPermissionOverride.findUnique.mockResolvedValue(null);
    mockPrisma.userPermissionOverride.upsert.mockResolvedValue({
      userId: 'user-1',
      permissionId: p1,
      type: OverrideType.GRANT,
    });

    const res = await service.grantUserOverride('user-1', p1, 'audit prep', 'admin-1');

    expect(res.type).toBe(OverrideType.GRANT);
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should deny user permission override', async () => {
    const p1 = '019183ab-1234-7111-a111-111111111111';
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.permission.findUnique.mockResolvedValue({ id: p1, name: 'student.delete' });
    mockPrisma.userPermissionOverride.findUnique.mockResolvedValue(null);
    mockPrisma.userPermissionOverride.upsert.mockResolvedValue({
      userId: 'user-1',
      permissionId: p1,
      type: OverrideType.DENY,
    });

    const res = await service.denyUserOverride('user-1', p1, 'security lock', 'admin-1');

    expect(res.type).toBe(OverrideType.DENY);
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should remove user permission override', async () => {
    const p1 = '019183ab-1234-7111-a111-111111111111';
    mockPrisma.userPermissionOverride.findUnique.mockResolvedValue({
      userId: 'user-1',
      permissionId: p1,
      type: OverrideType.GRANT,
      permission: { name: 'fees.collect' },
    });

    const res = await service.removeUserOverride('user-1', p1, 'admin-1');

    expect(res.success).toBe(true);
    expect(mockPrisma.userPermissionOverride.delete).toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should throw NotFoundException when removing non-existent override', async () => {
    mockPrisma.userPermissionOverride.findUnique.mockResolvedValue(null);

    await expect(
      service.removeUserOverride('user-1', 'invalid-id', 'admin-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
