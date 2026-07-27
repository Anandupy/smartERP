import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { PermissionResolverService } from '@/modules/authorization/permission-resolver.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { LoggerService } from '@/common/logger/logger.service';
import { RoleType, OverrideType } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AuthorizationService', () => {
  let service: AuthorizationService;

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorizationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PermissionResolverService, useValue: mockResolver },
        { provide: EventBus, useValue: mockEventBus },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<AuthorizationService>(AuthorizationService);
  });

  it('should allow access when user has required permissions (ALL mode)', async () => {
    mockResolver.resolvePermissions.mockResolvedValue({
      effectivePermissions: new Set(['student.view', 'student.create']),
    });

    const result = await service.canUserAccess(
      'user-1',
      RoleType.STAFF,
      ['student.view', 'student.create'],
      'ALL',
    );

    expect(result.allowed).toBe(true);
    expect(result.missingPermissions.length).toBe(0);
  });

  it('should deny access and publish event when missing permissions (ALL mode)', async () => {
    mockResolver.resolvePermissions.mockResolvedValue({
      effectivePermissions: new Set(['student.view']),
    });

    const result = await service.canUserAccess(
      'user-1',
      RoleType.STAFF,
      ['student.view', 'student.delete'],
      'ALL',
    );

    expect(result.allowed).toBe(false);
    expect(result.missingPermissions).toEqual(['student.delete']);
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should allow access when user has at least one permission in ANY mode', async () => {
    mockResolver.resolvePermissions.mockResolvedValue({
      effectivePermissions: new Set(['student.view']),
    });

    const result = await service.canUserAccess(
      'user-1',
      RoleType.STAFF,
      ['student.view', 'student.delete'],
      'ANY',
    );

    expect(result.allowed).toBe(true);
  });

  it('should assign permissions to a role in transaction', async () => {
    const p1 = '019183ab-1234-7111-a111-111111111111';
    mockPrisma.permission.findMany.mockResolvedValue([{ id: p1, name: 'student.view' }]);

    const res = await service.assignPermissionsToRole(RoleType.STAFF, [p1], 'admin-1');

    expect(res.role).toBe(RoleType.STAFF);
    expect(res.count).toBe(1);
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should throw BadRequestException if assigning invalid permission IDs', async () => {
    mockPrisma.permission.findMany.mockResolvedValue([]);

    await expect(
      service.assignPermissionsToRole(RoleType.STAFF, ['invalid-id'], 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should set direct user override (GRANT)', async () => {
    const p1 = '019183ab-1234-7111-a111-111111111111';
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.permission.findUnique.mockResolvedValue({ id: p1, name: 'fees.collect' });
    mockPrisma.userPermissionOverride.upsert.mockResolvedValue({
      userId: 'user-1',
      permissionId: p1,
      type: OverrideType.GRANT,
    });

    const res = await service.setUserOverride('user-1', p1, OverrideType.GRANT, 'test reason', 'admin-1');

    expect(res).toBeDefined();
    expect(mockEventBus.publish).toHaveBeenCalled();
  });
});
