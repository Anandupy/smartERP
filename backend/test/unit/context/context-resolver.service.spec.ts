import { Test, TestingModule } from '@nestjs/testing';
import { ContextResolverService } from '@/modules/context/services/context-resolver.service';
import { ContextDiscoveryService } from '@/modules/context/services/context-discovery.service';
import { ContextValidatorService } from '@/modules/context/services/context-validator.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { LoggerService } from '@/common/logger/logger.service';
import { RoleType } from '@/generated/client';
import { ConflictException } from '@nestjs/common';

describe('ContextResolverService', () => {
  let resolver: ContextResolverService;
  let discoveryService: any;
  let validatorService: any;
  let eventBus: any;
  let logger: any;

  const mockOrg = { id: 'org-1', name: 'Org 1', code: 'O1', status: 'ACTIVE' };
  const mockBranch = {
    id: 'branch-1',
    organizationId: 'org-1',
    name: 'Branch 1',
    code: 'B1',
    institutionType: 'K12',
    isActive: true,
    isDeleted: false,
  };
  const mockAy = {
    id: 'ay-1',
    branchId: 'branch-1',
    name: '2025-2026',
    startDate: new Date(),
    endDate: new Date(),
    isActive: true,
    isSelected: true,
    isLocked: false,
    isDeleted: false,
  };

  beforeEach(async () => {
    discoveryService = {
      discoverContexts: jest.fn(),
    };
    validatorService = {
      validateOrganization: jest.fn(),
      validateBranch: jest.fn(),
      validateAcademicYear: jest.fn(),
      validateFullContext: jest.fn(),
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextResolverService,
        { provide: ContextDiscoveryService, useValue: discoveryService },
        { provide: ContextValidatorService, useValue: validatorService },
        { provide: EventBus, useValue: eventBus },
        { provide: LoggerService, useValue: logger },
      ],
    }).compile();

    resolver = module.get<ContextResolverService>(ContextResolverService);
  });

  describe('Priority 1: Header Resolution', () => {
    it('should resolve context when valid headers are provided', async () => {
      validatorService.validateOrganization.mockResolvedValue(mockOrg);
      validatorService.validateBranch.mockResolvedValue(mockBranch);
      validatorService.validateAcademicYear.mockResolvedValue(mockAy);
      discoveryService.discoverContexts.mockResolvedValue({
        availableOrganizations: [mockOrg],
        availableBranches: [mockBranch],
        availableAcademicYears: [mockAy],
      });

      const res = await resolver.resolveContext({
        user: { id: 'u1', role: RoleType.SUPER_ADMIN },
        headers: {
          organizationId: 'org-1',
          branchId: 'branch-1',
          academicYearId: 'ay-1',
        },
      });

      expect(res.source).toBe('HEADER');
      expect(res.context.organizationId).toBe('org-1');
      expect(res.context.branchId).toBe('branch-1');
      expect(res.context.academicYearId).toBe('ay-1');
    });
  });

  describe('Priority 2: Automatic Resolution', () => {
    it('should auto-resolve single context user (e.g. Branch Admin)', async () => {
      discoveryService.discoverContexts.mockResolvedValue({
        availableOrganizations: [mockOrg],
        availableBranches: [mockBranch],
        availableAcademicYears: [mockAy],
      });
      validatorService.validateFullContext.mockResolvedValue({
        organization: mockOrg,
        branch: mockBranch,
        academicYear: mockAy,
      });

      const res = await resolver.resolveContext({
        user: {
          id: 'u2',
          role: RoleType.BRANCH_ADMIN,
          organizationId: 'org-1',
          branchId: 'branch-1',
        },
        headers: {},
      });

      expect(res.context.organizationId).toBe('org-1');
      expect(res.context.branchId).toBe('branch-1');
      expect(res.context.academicYearId).toBe('ay-1');
    });
  });

  describe('Priority 3: Selection Required (409 Conflict)', () => {
    it('should throw 409 Conflict CONTEXT_SELECTION_REQUIRED when ambiguity exists for Super Admin', async () => {
      discoveryService.discoverContexts.mockResolvedValue({
        availableOrganizations: [mockOrg, { id: 'org-2', name: 'Org 2', code: 'O2' }],
        availableBranches: [],
        availableAcademicYears: [],
      });

      await expect(
        resolver.resolveContext({
          user: { id: 'u-sa', role: RoleType.SUPER_ADMIN },
          headers: {},
        }),
      ).rejects.toThrow(ConflictException);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'context.selection_required' }),
      );
    });
  });
});
