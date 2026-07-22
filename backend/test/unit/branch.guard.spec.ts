import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ExecutionContext,
} from '@nestjs/common';
import { BranchGuard } from '@/common/guards/branch.guard';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { UserRole } from '@/common/enums/role.enum';

describe('BranchGuard', () => {
  let guard: BranchGuard;
  let reflector: Reflector;
  let prisma: PrismaService;

  const validBranchId = '11111111-1111-7111-a111-111111111111';
  const validOrgId = '99999999-9999-7999-a999-999999999999';
  const otherOrgId = '88888888-8888-7888-a888-888888888888';

  const mockPrisma = {
    branch: {
      findUnique: jest.fn(),
    },
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const createMockContext = (
    headers: Record<string, string> = {},
    user: any = null,
    contextData: any = {},
  ) => {
    const req: any = {
      headers,
      user,
      context: {
        requestId: 'req-123',
        branchId: headers['x-branch-id'] || user?.branchId || null,
        organizationId: user?.organizationId || null,
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    guard = module.get<BranchGuard>(BranchGuard);
    reflector = module.get<Reflector>(Reflector);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should pass through if endpoint has neither @RequireBranch nor @RequireAcademicYear', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(null);
    const context = createMockContext();

    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);
    expect(mockPrisma.branch.findUnique).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException if branchId is missing', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'requireBranch') return { optional: false };
      return null;
    });
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if branchId has invalid UUID format', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'requireBranch') return { optional: false };
      return null;
    });
    const context = createMockContext({ 'x-branch-id': 'invalid-uuid' });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if branch does not exist or is inactive/deleted', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'requireBranch') return { optional: false };
      return null;
    });
    mockPrisma.branch.findUnique.mockResolvedValue(null);

    const context = createMockContext({ 'x-branch-id': validBranchId });

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if user belongs to a different organization and is not SUPER_ADMIN', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'requireBranch') return { optional: false };
      return null;
    });
    mockPrisma.branch.findUnique.mockResolvedValue({
      id: validBranchId,
      organizationId: validOrgId,
      name: 'Alpha Branch',
      code: 'ALPHA',
      institutionType: 'SCHOOL',
      isActive: true,
      isDeleted: false,
    });

    const user = {
      id: 'user-1',
      role: UserRole.ORG_ADMIN,
      organizationId: otherOrgId, // Mismatching Organization!
    };

    const context = createMockContext({ 'x-branch-id': validBranchId }, user);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should pass and attach branch to context when valid headers & user org match', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'requireBranch') return { optional: false };
      return null;
    });

    const mockBranch = {
      id: validBranchId,
      organizationId: validOrgId,
      name: 'Alpha Branch',
      code: 'ALPHA',
      institutionType: 'SCHOOL',
      isActive: true,
      isDeleted: false,
    };
    mockPrisma.branch.findUnique.mockResolvedValue(mockBranch);

    const user = {
      id: 'user-1',
      role: UserRole.ORG_ADMIN,
      organizationId: validOrgId,
    };

    const context = createMockContext({ 'x-branch-id': validBranchId }, user);

    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);

    const req = context.switchToHttp().getRequest<any>();
    expect(req.context.branchId).toBe(validBranchId);
    expect(req.context.organizationId).toBe(validOrgId);
    expect(req.context.branch.name).toBe('Alpha Branch');
  });

  it('should allow SUPER_ADMIN to access branch across organizations', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key) => {
      if (key === 'requireBranch') return { optional: false };
      return null;
    });

    const mockBranch = {
      id: validBranchId,
      organizationId: validOrgId,
      name: 'Alpha Branch',
      code: 'ALPHA',
      institutionType: 'SCHOOL',
      isActive: true,
      isDeleted: false,
    };
    mockPrisma.branch.findUnique.mockResolvedValue(mockBranch);

    const user = {
      id: 'superadmin-1',
      role: UserRole.SUPER_ADMIN,
      organizationId: otherOrgId,
    };

    const context = createMockContext({ 'x-branch-id': validBranchId }, user);

    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);
  });
});
