import { Test, TestingModule } from '@nestjs/testing';
import { PermissionResolverService } from '@/modules/authorization/permission-resolver.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { LoggerService } from '@/common/logger/logger.service';
import { RoleType, OverrideType } from '@/generated/client';

describe('PermissionResolverService', () => {
  let resolver: PermissionResolverService;

  const mockPrisma: any = {
    userPermissionOverride: {
      findMany: jest.fn(),
    },
    rolePermission: {
      findMany: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
    },
  };

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionResolverService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    resolver = module.get<PermissionResolverService>(PermissionResolverService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should resolve role permissions correctly without user overrides', async () => {
    mockPrisma.userPermissionOverride.findMany.mockResolvedValue([]);
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permission: { name: 'student.view', isActive: true } },
      { permission: { name: 'student.create', isActive: true } },
    ]);

    const result = await resolver.resolvePermissions('user-1', RoleType.STAFF);

    expect(result.userId).toBe('user-1');
    expect(result.role).toBe(RoleType.STAFF);
    expect(result.effectivePermissions.has('student.view')).toBe(true);
    expect(result.effectivePermissions.has('student.create')).toBe(true);
    expect(result.effectivePermissions.size).toBe(2);
    expect(typeof result.resolutionDurationMs).toBe('number');
  });

  it('should grant additional permission via UserPermissionOverride (GRANT)', async () => {
    mockPrisma.userPermissionOverride.findMany.mockResolvedValue([
      { type: OverrideType.GRANT, permission: { name: 'fees.collect', isActive: true } },
    ]);
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permission: { name: 'student.view', isActive: true } },
    ]);

    const result = await resolver.resolvePermissions('user-1', RoleType.STAFF);

    expect(result.effectivePermissions.has('student.view')).toBe(true);
    expect(result.effectivePermissions.has('fees.collect')).toBe(true);
    expect(result.effectivePermissions.size).toBe(2);
  });

  it('should deny role permission via UserPermissionOverride (DENY)', async () => {
    mockPrisma.userPermissionOverride.findMany.mockResolvedValue([
      { type: OverrideType.DENY, permission: { name: 'student.create', isActive: true } },
    ]);
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permission: { name: 'student.view', isActive: true } },
      { permission: { name: 'student.create', isActive: true } },
    ]);

    const result = await resolver.resolvePermissions('user-1', RoleType.STAFF);

    expect(result.effectivePermissions.has('student.view')).toBe(true);
    expect(result.effectivePermissions.has('student.create')).toBe(false);
    expect(result.effectivePermissions.size).toBe(1);
  });

  it('should resolve SUPER_ADMIN to all active system permissions', async () => {
    mockPrisma.userPermissionOverride.findMany.mockResolvedValue([]);
    mockPrisma.permission.findMany.mockResolvedValue([
      { name: 'student.view' },
      { name: 'student.create' },
      { name: 'fees.refund' },
      { name: 'system.manage' },
    ]);

    const result = await resolver.resolvePermissions('admin-1', RoleType.SUPER_ADMIN);

    expect(result.isSuperAdmin).toBe(true);
    expect(result.effectivePermissions.size).toBe(4);
    expect(result.effectivePermissions.has('system.manage')).toBe(true);
  });

  it('should support extension hooks for Redis, HR, and Profiles', async () => {
    mockPrisma.userPermissionOverride.findMany.mockResolvedValue([]);
    mockPrisma.rolePermission.findMany.mockResolvedValue([]);

    const cacheRes = await resolver.resolvePermissionsWithCache('user-1', RoleType.STAFF);
    expect(cacheRes).toBeDefined();

    const hrRes = await resolver.resolveHRPermissions('user-1', 'desig-1');
    expect(hrRes).toEqual([]);

    const profileRes = await resolver.resolvePermissionProfiles('user-1', ['prof-1']);
    expect(profileRes).toEqual([]);
  });
});
