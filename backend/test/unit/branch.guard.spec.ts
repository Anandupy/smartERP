import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { BranchGuard } from '@/common/guards/branch.guard';
import { REQUIRE_BRANCH_KEY } from '@/common/decorators/branch.decorator';
import { REQUIRE_ACADEMIC_YEAR_KEY } from '@/common/decorators/academic-year.decorator';
import { MutableRequestContext } from '@/common/logger/request-context.middleware';
import { buildRequestContext } from '../factories/request-context.factory';

/**
 * BranchGuard asserts the branch scope that ExecutionContextGuard resolved.
 * It performs no lookups of its own, so these tests exercise the assertion
 * only — resolution and tenant-boundary rules are covered by the context
 * resolver and validator suites.
 */
describe('BranchGuard', () => {
  let guard: BranchGuard;

  const validBranchId = '11111111-1111-7111-a111-111111111111';
  const validOrgId = '99999999-9999-7999-a999-999999999999';

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const createMockContext = (
    contextData: Partial<MutableRequestContext> = {},
  ) => {
    const req: any = {
      headers: {},
      context: buildRequestContext(contextData),
    };

    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  /** Declares which scope decorators the route under test carries. */
  const declareRoute = (options: {
    branch?: unknown;
    academicYear?: unknown;
  }) => {
    mockReflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_BRANCH_KEY) return options.branch ?? null;
      if (key === REQUIRE_ACADEMIC_YEAR_KEY)
        return options.academicYear ?? null;
      return null;
    });
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BranchGuard, { provide: Reflector, useValue: mockReflector }],
    }).compile();

    guard = module.get<BranchGuard>(BranchGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('passes through when the route declares neither scope decorator', () => {
    declareRoute({});

    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('passes when @RequireBranch() is declared and the context carries a branch', () => {
    declareRoute({ branch: { optional: false } });

    const context = createMockContext({
      branchId: validBranchId,
      organizationId: validOrgId,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws when @RequireBranch() is declared and no branch was resolved', () => {
    declareRoute({ branch: { optional: false } });

    expect(() => guard.canActivate(createMockContext())).toThrow(
      BadRequestException,
    );
  });

  it('passes with no resolved branch when @RequireBranch({ optional: true })', () => {
    declareRoute({ branch: { optional: true } });

    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('requires a branch when only @RequireAcademicYear() is declared', () => {
    declareRoute({ academicYear: { optional: false, allowFallback: true } });

    expect(() => guard.canActivate(createMockContext())).toThrow(
      BadRequestException,
    );
  });

  it('does not read branch scope from request headers', () => {
    declareRoute({ branch: { optional: false } });

    const context = createMockContext();
    const req = context.switchToHttp().getRequest<any>();
    // A spoofed header must not satisfy the requirement: only the resolved
    // context counts.
    req.headers['x-branch-id'] = validBranchId;

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });
});
