import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { BadRequestException, NotFoundException, ExecutionContext } from '@nestjs/common';
import { AcademicYearGuard } from '@/common/guards/academic-year.guard';
import { PrismaService } from '@/infrastructure/database/prisma.service';

describe('AcademicYearGuard', () => {
  let guard: AcademicYearGuard;
  let reflector: Reflector;
  let prisma: PrismaService;

  const validBranchId = '11111111-1111-4111-a111-111111111111';
  const validAcademicYearId = '22222222-2222-4222-a222-222222222222';
  const otherBranchId = '33333333-3333-4333-a333-333333333333';

  const mockPrisma = {
    branch: {
      findUnique: jest.fn(),
    },
    academicYear: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const createMockContext = (headers: Record<string, string> = {}, contextData: any = {}) => {
    const req: any = {
      headers,
      context: {
        requestId: 'req-123',
        branchId: headers['x-branch-id'] || null,
        academicYearId: headers['x-academic-year-id'] || null,
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicYearGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    guard = module.get<AcademicYearGuard>(AcademicYearGuard);
    reflector = module.get<Reflector>(Reflector);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should pass through if route is not decorated with @RequireAcademicYear', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(null);
    const context = createMockContext();

    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);
    expect(mockPrisma.branch.findUnique).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException if branchId is missing', async () => {
    mockReflector.getAllAndOverride.mockReturnValue({ allowFallback: true });
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if branchId is invalid UUID format', async () => {
    mockReflector.getAllAndOverride.mockReturnValue({ allowFallback: true });
    const context = createMockContext({ 'x-branch-id': 'invalid-uuid' });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if branch does not exist or is deleted', async () => {
    mockReflector.getAllAndOverride.mockReturnValue({ allowFallback: true });
    mockPrisma.branch.findUnique.mockResolvedValue(null);
    const context = createMockContext({ 'x-branch-id': validBranchId });

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if academicYearId is invalid UUID format', async () => {
    mockReflector.getAllAndOverride.mockReturnValue({ allowFallback: true });
    mockPrisma.branch.findUnique.mockResolvedValue({ id: validBranchId, isActive: true, isDeleted: false });
    const context = createMockContext({
      'x-branch-id': validBranchId,
      'x-academic-year-id': 'invalid-uuid',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if academic year does not exist', async () => {
    mockReflector.getAllAndOverride.mockReturnValue({ allowFallback: true });
    mockPrisma.branch.findUnique.mockResolvedValue({ id: validBranchId, isActive: true, isDeleted: false });
    mockPrisma.academicYear.findUnique.mockResolvedValue(null);

    const context = createMockContext({
      'x-branch-id': validBranchId,
      'x-academic-year-id': validAcademicYearId,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if academic year belongs to a different branch', async () => {
    mockReflector.getAllAndOverride.mockReturnValue({ allowFallback: true });
    mockPrisma.branch.findUnique.mockResolvedValue({ id: validBranchId, isActive: true, isDeleted: false });
    mockPrisma.academicYear.findUnique.mockResolvedValue({
      id: validAcademicYearId,
      branchId: otherBranchId,
      isDeleted: false,
    });

    const context = createMockContext({
      'x-branch-id': validBranchId,
      'x-academic-year-id': validAcademicYearId,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should attach resolved academic year to context when valid headers are provided', async () => {
    mockReflector.getAllAndOverride.mockReturnValue({ allowFallback: true });
    mockPrisma.branch.findUnique.mockResolvedValue({ id: validBranchId, isActive: true, isDeleted: false });

    const mockAy = {
      id: validAcademicYearId,
      branchId: validBranchId,
      name: '2025-2026',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2026-03-31'),
      isActive: true,
      isSelected: true,
      isLocked: false,
      isDeleted: false,
    };
    mockPrisma.academicYear.findUnique.mockResolvedValue(mockAy);

    const context = createMockContext({
      'x-branch-id': validBranchId,
      'x-academic-year-id': validAcademicYearId,
    });

    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);

    const req = context.switchToHttp().getRequest<any>();
    expect(req.context.academicYearId).toBe(validAcademicYearId);
    expect(req.context.academicYear.name).toBe('2025-2026');
  });

  it('should fallback to selected academic year if header is omitted and allowFallback is true', async () => {
    mockReflector.getAllAndOverride.mockReturnValue({ allowFallback: true });
    mockPrisma.branch.findUnique.mockResolvedValue({ id: validBranchId, isActive: true, isDeleted: false });

    const mockSelectedAy = {
      id: validAcademicYearId,
      branchId: validBranchId,
      name: '2025-2026',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2026-03-31'),
      isActive: true,
      isSelected: true,
      isLocked: false,
      isDeleted: false,
    };
    mockPrisma.academicYear.findFirst.mockResolvedValue(mockSelectedAy);

    const context = createMockContext({
      'x-branch-id': validBranchId,
    });

    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);

    const req = context.switchToHttp().getRequest<any>();
    expect(req.context.academicYearId).toBe(validAcademicYearId);
  });
});
