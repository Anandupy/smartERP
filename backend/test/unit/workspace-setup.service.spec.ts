import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { WorkspaceSetupService } from '@/modules/workspace/setup/workspace-setup.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { LoggerService } from '@/common/logger/logger.service';

describe('WorkspaceSetupService', () => {
  let service: WorkspaceSetupService;

  const mockPrisma = {
    workspaceState: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    organization: { findFirst: jest.fn() },
    branch: { findFirst: jest.fn() },
    academicYear: { findFirst: jest.fn() },
  };

  /** Describes which bootstrap resources exist in the database. */
  const withResources = (opts: {
    organization?: boolean;
    branch?: boolean;
    academicYear?: boolean;
  }) => {
    mockPrisma.organization.findFirst.mockResolvedValue(
      opts.organization ? { id: 'org-1' } : null,
    );
    mockPrisma.branch.findFirst.mockResolvedValue(
      opts.branch ? { id: 'branch-1' } : null,
    );
    mockPrisma.academicYear.findFirst.mockResolvedValue(
      opts.academicYear ? { id: 'ay-1' } : null,
    );
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceSetupService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: LoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn() },
        },
      ],
    }).compile();

    service = await module.resolve(WorkspaceSetupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('reports ORGANIZATION as the first stage on an empty installation', async () => {
      mockPrisma.workspaceState.findUnique.mockResolvedValue(null);
      withResources({});

      const status = await service.getStatus();

      expect(status.setupRequired).toBe(true);
      expect(status.setupStage).toBe('ORGANIZATION');
      expect(status.missingResources).toEqual([
        'ORGANIZATION',
        'BRANCH',
        'ACADEMIC_YEAR',
      ]);
      expect(status.completedResources).toEqual([]);
      expect(status.allowedActions.length).toBeGreaterThan(0);
      expect(status.initializedAt).toBeNull();
    });

    it('advances to BRANCH once an organization exists', async () => {
      mockPrisma.workspaceState.findUnique.mockResolvedValue(null);
      withResources({ organization: true });

      const status = await service.getStatus();

      expect(status.setupStage).toBe('BRANCH');
      expect(status.completedResources).toEqual(['ORGANIZATION']);
      expect(status.missingResources).toEqual(['BRANCH', 'ACADEMIC_YEAR']);
    });

    it('advances to ACADEMIC_YEAR once a branch exists', async () => {
      mockPrisma.workspaceState.findUnique.mockResolvedValue(null);
      withResources({ organization: true, branch: true });

      const status = await service.getStatus();

      expect(status.setupStage).toBe('ACADEMIC_YEAR');
      expect(status.missingResources).toEqual(['ACADEMIC_YEAR']);
    });

    it('reports FINALIZE when every resource exists but setup was never completed', async () => {
      mockPrisma.workspaceState.findUnique.mockResolvedValue(null);
      withResources({ organization: true, branch: true, academicYear: true });

      const status = await service.getStatus();

      // Completion is explicit: having the data is not the same as being live.
      expect(status.setupStage).toBe('FINALIZE');
      expect(status.setupRequired).toBe(true);
      expect(status.missingResources).toEqual([]);
    });

    it('reports COMPLETED and offers no setup actions once initialized', async () => {
      mockPrisma.workspaceState.findUnique.mockResolvedValue({
        initializedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      withResources({ organization: true, branch: true, academicYear: true });

      const status = await service.getStatus();

      expect(status.setupRequired).toBe(false);
      expect(status.setupStage).toBe('COMPLETED');
      expect(status.allowedActions).toEqual([]);
      expect(status.initializedAt).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('isInitialized', () => {
    it('is false while the state row is absent', async () => {
      mockPrisma.workspaceState.findUnique.mockResolvedValue(null);

      expect(await service.isInitialized()).toBe(false);
    });

    it('is false while the row exists without a completion timestamp', async () => {
      mockPrisma.workspaceState.findUnique.mockResolvedValue({
        initializedAt: null,
      });

      expect(await service.isInitialized()).toBe(false);
    });

    it('latches, so a completed workspace is not re-queried', async () => {
      mockPrisma.workspaceState.findUnique.mockResolvedValue({
        initializedAt: new Date(),
      });

      expect(await service.isInitialized()).toBe(true);
      expect(await service.isInitialized()).toBe(true);

      // Completion is irreversible, so one read is enough for the process.
      expect(mockPrisma.workspaceState.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('markInitialized', () => {
    it('refuses while a required resource is missing', async () => {
      mockPrisma.workspaceState.findUnique.mockResolvedValue(null);
      withResources({ organization: true });

      await expect(service.markInitialized('user-1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.workspaceState.upsert).not.toHaveBeenCalled();
    });

    it('records completion with the acting user', async () => {
      mockPrisma.workspaceState.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ initializedAt: new Date('2026-02-01') });
      withResources({ organization: true, branch: true, academicYear: true });

      const status = await service.markInitialized('user-1');

      expect(mockPrisma.workspaceState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { scope: 'GLOBAL' },
          update: expect.objectContaining({ initializedById: 'user-1' }),
        }),
      );
      expect(status.setupRequired).toBe(false);
    });

    it('is idempotent once the workspace is already initialized', async () => {
      mockPrisma.workspaceState.findUnique.mockResolvedValue({
        initializedAt: new Date('2026-02-01'),
      });
      withResources({ organization: true, branch: true, academicYear: true });

      const status = await service.markInitialized('user-2');

      expect(mockPrisma.workspaceState.upsert).not.toHaveBeenCalled();
      expect(status.setupStage).toBe('COMPLETED');
    });
  });
});
