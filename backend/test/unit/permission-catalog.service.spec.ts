import { Test, TestingModule } from '@nestjs/testing';
import { PermissionCatalogService } from '@/modules/authorization/permission-catalog.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { LoggerService } from '@/common/logger/logger.service';
import { NotFoundException } from '@nestjs/common';

describe('PermissionCatalogService', () => {
  let service: PermissionCatalogService;

  const mockPrisma: any = {
    permissionCategory: {
      findMany: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
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
        PermissionCatalogService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<PermissionCatalogService>(PermissionCatalogService);
  });

  it('should list categories ordered by displayOrder', async () => {
    mockPrisma.permissionCategory.findMany.mockResolvedValue([
      { id: 'cat-1', code: 'STUDENTS', name: 'Students', displayOrder: 1 },
    ]);

    const res = await service.getCategories();
    expect(res.length).toBe(1);
    expect(res[0].code).toBe('STUDENTS');
  });

  it('should list permissions with optional category filter', async () => {
    mockPrisma.permission.findMany.mockResolvedValue([
      { id: 'perm-1', name: 'student.view', categoryId: 'cat-1' },
    ]);

    const res = await service.getPermissions('cat-1');
    expect(res.length).toBe(1);
    expect(mockPrisma.permission.findMany).toHaveBeenCalledWith({
      where: { isActive: true, categoryId: 'cat-1' },
      include: { category: true },
      orderBy: [{ category: { displayOrder: 'asc' } }, { displayOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('should get permission by ID', async () => {
    mockPrisma.permission.findUnique.mockResolvedValue({ id: 'perm-1', name: 'student.view' });

    const res = await service.getPermissionById('perm-1');
    expect(res.name).toBe('student.view');
  });

  it('should throw NotFoundException for non-existent permission ID', async () => {
    mockPrisma.permission.findUnique.mockResolvedValue(null);

    await expect(service.getPermissionById('invalid-id')).rejects.toThrow(NotFoundException);
  });

  it('should retrieve permission metadata', async () => {
    mockPrisma.permission.findFirst.mockResolvedValue({
      id: 'perm-1',
      name: 'student.view',
      description: 'View student details',
      isSystem: true,
      isActive: true,
      displayOrder: 1,
      category: { code: 'STUDENTS', name: 'Students' },
    });

    const meta = await service.getPermissionMetadata('student.view');

    expect(meta.name).toBe('student.view');
    expect(meta.categoryCode).toBe('STUDENTS');
    expect(meta.isSystem).toBe(true);
  });
});
