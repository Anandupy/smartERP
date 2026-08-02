import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContextGuard } from '@/modules/context/guards/execution-context.guard';
import { ContextResolverService } from '@/modules/context/services/context-resolver.service';
import { WorkspaceSetupService } from '@/modules/workspace/setup/workspace-setup.service';
import { Reflector } from '@nestjs/core';
import { RoleType } from '@/generated/client';
import { buildRequestContext } from '../../factories/request-context.factory';

describe('ExecutionContextGuard', () => {
  let guard: ExecutionContextGuard;
  let reflector: any;
  let resolver: any;
  let setupService: any;

  const buildRequest = (overrides: Record<string, unknown> = {}) => ({
    user: {
      id: 'u1',
      role: RoleType.STAFF,
      organizationId: 'org-1',
      branchId: 'branch-1',
    },
    headers: { 'x-academic-year-id': 'ay-1' },
    requestId: 'req-123',
    // In production RequestContextMiddleware always creates this before any
    // guard runs; the guard mutates it rather than creating it.
    context: buildRequestContext({ requestId: 'req-123' }),
    ...overrides,
  });

  const asExecutionContext = (req: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => {},
      getClass: () => {},
    }) as any;

  beforeEach(async () => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    resolver = {
      resolveContext: jest.fn(),
      resolveBootstrapContext: jest.fn(),
    };
    // Default to an initialized workspace: the strict resolution path.
    setupService = {
      isInitialized: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionContextGuard,
        { provide: Reflector, useValue: reflector },
        { provide: ContextResolverService, useValue: resolver },
        { provide: WorkspaceSetupService, useValue: setupService },
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
    const mockReq = buildRequest();

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

    const can = await guard.canActivate(asExecutionContext(mockReq));
    expect(can).toBe(true);
    expect(mockReq.context.organizationId).toBe('org-1');
    expect(mockReq.context.branchId).toBe('branch-1');
    expect(mockReq.context.academicYearId).toBe('ay-1');
    expect(mockReq.context.programId).toBeNull();
  });

  it('should write identity onto the context and request', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const mockReq: any = buildRequest();

    resolver.resolveContext.mockResolvedValue({
      context: {
        organizationId: 'org-1',
        branchId: 'branch-1',
        academicYearId: 'ay-1',
        programId: null,
        departmentId: null,
        campusId: null,
        branch: null,
        academicYear: null,
      },
      source: 'AUTO',
    });

    await guard.canActivate(asExecutionContext(mockReq));

    expect(mockReq.context.userId).toBe('u1');
    expect(mockReq.context.role).toBe(RoleType.STAFF);
    // Controllers read req.userId for audit attribution.
    expect(mockReq.userId).toBe('u1');
  });

  it('records identity even when context resolution fails', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const mockReq: any = buildRequest();

    resolver.resolveContext.mockRejectedValue(
      new Error('No active organization available for user.'),
    );

    await expect(
      guard.canActivate(asExecutionContext(mockReq)),
    ).rejects.toThrow('No active organization available for user.');

    // The failure must still be attributable.
    expect(mockReq.context.userId).toBe('u1');
    expect(mockReq.context.role).toBe(RoleType.STAFF);
    expect(mockReq.context.organizationId).toBeNull();
  });

  it('leaves the context untouched when there is no authenticated user', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const mockReq: any = buildRequest({ user: undefined });

    const can = await guard.canActivate(asExecutionContext(mockReq));

    expect(can).toBe(true);
    expect(resolver.resolveContext).not.toHaveBeenCalled();
    expect(mockReq.context.userId).toBeNull();
  });
});
