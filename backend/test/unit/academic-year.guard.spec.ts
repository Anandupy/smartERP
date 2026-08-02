import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { AcademicYearGuard } from '@/common/guards/academic-year.guard';
import { MutableRequestContext } from '@/common/logger/request-context.middleware';
import { buildRequestContext } from '../factories/request-context.factory';

/**
 * AcademicYearGuard asserts the academic-year scope that ExecutionContextGuard
 * resolved. Resolution — including the fallback to the branch's selected or
 * active year — lives in the context resolver and is covered by its own suite.
 */
describe('AcademicYearGuard', () => {
  let guard: AcademicYearGuard;

  const validBranchId = '11111111-1111-7111-a111-111111111111';
  const validAcademicYearId = '22222222-2222-7222-a222-222222222222';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicYearGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<AcademicYearGuard>(AcademicYearGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('passes through when the route is not decorated with @RequireAcademicYear', () => {
    mockReflector.getAllAndOverride.mockReturnValue(null);

    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('throws when no branch scope was resolved', () => {
    mockReflector.getAllAndOverride.mockReturnValue({ allowFallback: true });

    expect(() => guard.canActivate(createMockContext())).toThrow(
      BadRequestException,
    );
  });

  it('passes when both branch and academic year were resolved', () => {
    mockReflector.getAllAndOverride.mockReturnValue({ allowFallback: true });

    const context = createMockContext({
      branchId: validBranchId,
      academicYearId: validAcademicYearId,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws when a branch is in scope but no academic year was resolved', () => {
    mockReflector.getAllAndOverride.mockReturnValue({
      optional: false,
      allowFallback: true,
    });

    const context = createMockContext({ branchId: validBranchId });

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('passes with no academic year when the requirement is optional', () => {
    mockReflector.getAllAndOverride.mockReturnValue({
      optional: true,
      allowFallback: true,
    });

    const context = createMockContext({ branchId: validBranchId });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('does not read academic-year scope from request headers', () => {
    mockReflector.getAllAndOverride.mockReturnValue({
      optional: false,
      allowFallback: true,
    });

    const context = createMockContext({ branchId: validBranchId });
    const req = context.switchToHttp().getRequest<any>();
    req.headers['x-academic-year-id'] = validAcademicYearId;

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });
});
