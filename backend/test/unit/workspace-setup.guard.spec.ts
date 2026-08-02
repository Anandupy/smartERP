import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ConflictException, ExecutionContext } from '@nestjs/common';
import { WorkspaceSetupGuard } from '@/common/guards/workspace-setup.guard';
import { WorkspaceSetupService } from '@/modules/workspace/setup/workspace-setup.service';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { ALLOW_DURING_SETUP_KEY } from '@/common/decorators/allow-during-setup.decorator';
import { buildRequestContext } from '../factories/request-context.factory';

describe('WorkspaceSetupGuard', () => {
  let guard: WorkspaceSetupGuard;

  const mockReflector = { getAllAndOverride: jest.fn() };
  const mockSetupService = {
    isInitialized: jest.fn(),
    getStatus: jest.fn(),
  };

  const declareRoute = (opts: {
    public?: boolean;
    allowDuringSetup?: boolean;
  }) => {
    mockReflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return opts.public ?? false;
      if (key === ALLOW_DURING_SETUP_KEY) return opts.allowDuringSetup ?? false;
      return undefined;
    });
  };

  const createContext = (user: unknown = { id: 'u1' }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user, context: buildRequestContext() }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceSetupGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: WorkspaceSetupService, useValue: mockSetupService },
      ],
    }).compile();

    guard = module.get<WorkspaceSetupGuard>(WorkspaceSetupGuard);
    mockSetupService.getStatus.mockResolvedValue({
      setupRequired: true,
      setupStage: 'ORGANIZATION',
      missingResources: ['ORGANIZATION', 'BRANCH', 'ACADEMIC_YEAR'],
      completedResources: [],
      allowedActions: [{ action: 'CREATE_ORGANIZATION' }],
      initializedAt: null,
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('passes every route once the workspace is initialized', async () => {
    declareRoute({});
    mockSetupService.isInitialized.mockResolvedValue(true);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(mockSetupService.getStatus).not.toHaveBeenCalled();
  });

  it('passes public routes without consulting setup state', async () => {
    declareRoute({ public: true });

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(mockSetupService.isInitialized).not.toHaveBeenCalled();
  });

  it('passes unauthenticated requests through to the authentication failure', async () => {
    declareRoute({});

    await expect(guard.canActivate(createContext(undefined))).resolves.toBe(
      true,
    );
  });

  it('allows routes marked @AllowDuringSetup while setup is incomplete', async () => {
    declareRoute({ allowDuringSetup: true });
    mockSetupService.isInitialized.mockResolvedValue(false);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('blocks ordinary routes with an actionable SETUP_REQUIRED payload', async () => {
    declareRoute({});
    mockSetupService.isInitialized.mockResolvedValue(false);

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      ConflictException,
    );

    try {
      await guard.canActivate(createContext());
    } catch (error) {
      const response = (error as ConflictException).getResponse() as Record<
        string,
        unknown
      >;
      // The client must be able to act on the rejection without guessing.
      expect(response.error).toBe('SETUP_REQUIRED');
      expect(response.setupStage).toBe('ORGANIZATION');
      expect(response.missingResources).toEqual([
        'ORGANIZATION',
        'BRANCH',
        'ACADEMIC_YEAR',
      ]);
      expect(response.allowedActions).toHaveLength(1);
    }
  });
});
