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
      findBranchOrganizationId: jest.fn(),
      findAcademicYearBranchId: jest.fn(),
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

    it('derives the organization from a branch header alone', async () => {
      // A branch belongs to exactly one organization, so a client that named a
      // branch has named its organization. Asking it to select one asks it to
      // repeat itself, and answering 409 because it did not is how a correctly
      // scoped request failed.
      validatorService.findBranchOrganizationId.mockResolvedValue('org-1');
      validatorService.validateOrganization.mockResolvedValue(mockOrg);
      validatorService.validateBranch.mockResolvedValue(mockBranch);
      validatorService.validateAcademicYear.mockResolvedValue(mockAy);
      discoveryService.discoverContexts.mockResolvedValue({
        availableOrganizations: [mockOrg, { id: 'org-2', name: 'Org 2' }],
        availableBranches: [mockBranch],
        availableAcademicYears: [mockAy],
      });

      const res = await resolver.resolveContext({
        user: { id: 'u1', role: RoleType.SUPER_ADMIN },
        headers: { branchId: 'branch-1' },
      });

      expect(res.source).toBe('HEADER');
      expect(res.context.organizationId).toBe('org-1');
      expect(res.context.branchId).toBe('branch-1');
      // Derivation is a lookup, not a grant: access is still decided here.
      expect(validatorService.validateOrganization).toHaveBeenCalledWith(
        'org-1',
        'u1',
        RoleType.SUPER_ADMIN,
        undefined,
      );
    });

    it('derives the branch and organization from an academic-year header alone', async () => {
      validatorService.findAcademicYearBranchId.mockResolvedValue('branch-1');
      validatorService.findBranchOrganizationId.mockResolvedValue('org-1');
      validatorService.validateOrganization.mockResolvedValue(mockOrg);
      validatorService.validateBranch.mockResolvedValue(mockBranch);
      validatorService.validateAcademicYear.mockResolvedValue(mockAy);
      discoveryService.discoverContexts.mockResolvedValue({
        availableOrganizations: [mockOrg, { id: 'org-2', name: 'Org 2' }],
        availableBranches: [mockBranch],
        availableAcademicYears: [mockAy],
      });

      const res = await resolver.resolveContext({
        user: { id: 'u1', role: RoleType.SUPER_ADMIN },
        headers: { academicYearId: 'ay-1' },
      });

      expect(res.context.organizationId).toBe('org-1');
      expect(res.context.branchId).toBe('branch-1');
      expect(res.context.academicYearId).toBe('ay-1');
    });

    it('falls back to discovery when the named branch does not resolve', async () => {
      // An unknown id must not become a different error than it would have
      // been: the request rejoins the ordinary path.
      validatorService.findBranchOrganizationId.mockResolvedValue(null);
      discoveryService.discoverContexts.mockResolvedValue({
        availableOrganizations: [mockOrg, { id: 'org-2', name: 'Org 2' }],
        availableBranches: [],
        availableAcademicYears: [],
      });

      await expect(
        resolver.resolveContext({
          user: { id: 'u1', role: RoleType.SUPER_ADMIN },
          headers: { branchId: 'branch-unknown' },
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Priority 2: Automatic Resolution', () => {
    it('resolves with a null academic year when the branch has none', async () => {
      // A newly created branch has no academic year yet. Failing resolution
      // here made the branch unusable: every request against it errored,
      // including the one that would have created its first academic year.
      discoveryService.discoverContexts.mockResolvedValue({
        availableOrganizations: [mockOrg],
        availableBranches: [mockBranch],
        availableAcademicYears: [],
      });
      validatorService.validateOrganization.mockResolvedValue(mockOrg);
      validatorService.validateBranch.mockResolvedValue(mockBranch);

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
      expect(res.context.academicYearId).toBeNull();
      expect(res.context.academicYear).toBeNull();
      expect(validatorService.validateAcademicYear).not.toHaveBeenCalled();
    });

    it('should auto-resolve single context user (e.g. Branch Admin)', async () => {
      discoveryService.discoverContexts.mockResolvedValue({
        availableOrganizations: [mockOrg],
        availableBranches: [mockBranch],
        availableAcademicYears: [mockAy],
      });
      // The auto path validates each level individually so that a branch with
      // no academic year resolves with a null year instead of failing.
      validatorService.validateOrganization.mockResolvedValue(mockOrg);
      validatorService.validateBranch.mockResolvedValue(mockBranch);
      validatorService.validateAcademicYear.mockResolvedValue(mockAy);

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
        availableOrganizations: [
          mockOrg,
          { id: 'org-2', name: 'Org 2', code: 'O2' },
        ],
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

    it('resolves an organization-only scope when the organization has no branch', async () => {
      // Absence is not ambiguity. A freshly created organization has no branch,
      // and answering CONTEXT_SELECTION_REQUIRED with an empty candidate list
      // asked the client to choose from nothing — so every request against that
      // organization failed, including the one creating its first branch.
      discoveryService.discoverContexts.mockResolvedValue({
        availableOrganizations: [mockOrg],
        availableBranches: [],
        availableAcademicYears: [],
      });
      validatorService.validateOrganization.mockResolvedValue(mockOrg);

      const res = await resolver.resolveContext({
        user: { id: 'u3', role: RoleType.ORG_ADMIN, organizationId: 'org-1' },
        headers: {},
      });

      expect(res.context.organizationId).toBe('org-1');
      expect(res.context.branchId).toBeNull();
      expect(res.context.academicYearId).toBeNull();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('leaves the scope unresolved instead of throwing when no selection is required', async () => {
      const secondOrg = { id: 'org-2', name: 'Org 2', code: 'O2' };
      discoveryService.discoverContexts.mockResolvedValue({
        availableOrganizations: [mockOrg, secondOrg],
        availableBranches: [],
        availableAcademicYears: [],
      });

      const res = await resolver.resolveContext(
        { user: { id: 'u-sa', role: RoleType.SUPER_ADMIN }, headers: {} },
        { selectionRequired: false },
      );

      expect(res.source).toBe('UNRESOLVED');
      expect(res.context.organizationId).toBeNull();
      expect(res.context.branchId).toBeNull();
      // The candidates still come back, so /auth/me can report them.
      expect(res.discovery.availableOrganizations).toHaveLength(2);
      // Not a failure, so nothing is audited as one.
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('still validates a supplied header when no selection is required', async () => {
      // Opting out of the selection does not opt out of the tenant boundary:
      // the header is resolved and validated exactly as it always was.
      discoveryService.discoverContexts.mockResolvedValue({
        availableOrganizations: [mockOrg],
        availableBranches: [mockBranch],
        availableAcademicYears: [mockAy],
      });
      validatorService.validateOrganization.mockResolvedValue(mockOrg);
      validatorService.validateBranch.mockResolvedValue(mockBranch);
      validatorService.validateAcademicYear.mockResolvedValue(mockAy);

      const res = await resolver.resolveContext(
        {
          user: { id: 'u1', role: RoleType.SUPER_ADMIN },
          headers: { organizationId: 'org-1' },
        },
        { selectionRequired: false },
      );

      expect(res.source).toBe('HEADER');
      expect(res.context.organizationId).toBe('org-1');
      expect(validatorService.validateOrganization).toHaveBeenCalledWith(
        'org-1',
        'u1',
        RoleType.SUPER_ADMIN,
        undefined,
      );
    });
  });
});
