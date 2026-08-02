import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContextGuard } from '@/modules/context/guards/execution-context.guard';
import { ContextResolverService } from '@/modules/context/services/context-resolver.service';
import { Reflector } from '@nestjs/core';
import { RoleType } from '@/generated/client';

describe('ExecutionContextGuard', () => {
  let guard: ExecutionContextGuard;
  let reflector: any;
  let resolver: any;

  beforeEach(async () => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    resolver = {
      resolveContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionContextGuard,
        { provide: Reflector, useValue: reflector },
        { provide: ContextResolverService, useValue: resolver },
      ],
    }).compile();

    guard = module.get<ExecutionContextGuard>(ExecutionContextGuard);
  });

  it('should pass through for public routes', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const mockContext: any = {
      getHandler: () => {},
      getClass: () => {},
    };

    const can = await guard.canActivate(mockContext);
    expect(can).toBe(true);
  });

  it('should resolve and attach execution context to request for authenticated users', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const mockReq: any = {
      user: { id: 'u1', role: RoleType.STAFF, organizationId: 'org-1', branchId: 'branch-1' },
      headers: { 'x-academic-year-id': 'ay-1' },
      requestId: 'req-123',
    };

    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockReq,
      }),
      getHandler: () => {},
      getClass: () => {},
    } as any;

    resolver.resolveContext.mockResolvedValue({
      context: {
        organizationId: 'org-1',
        branchId: 'branch-1',
        academicYearId: 'ay-1',
        programId: null,
        departmentId: null,
        campusId: null,
        branch: { id: 'branch-1', name: 'B1' },
        academicYear: { id: 'ay-1', name: '2025-26' },
      },
      source: 'HEADER',
    });

    const can = await guard.canActivate(mockExecutionContext);
    expect(can).toBe(true);
    expect(mockReq.context.organizationId).toBe('org-1');
    expect(mockReq.context.branchId).toBe('branch-1');
    expect(mockReq.context.academicYearId).toBe('ay-1');
    expect(mockReq.context.programId).toBeNull();
  });
});
