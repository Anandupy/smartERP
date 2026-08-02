import { Test, TestingModule } from '@nestjs/testing';
import { ContextValidatorService } from '@/modules/context/services/context-validator.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RoleType, OrganizationStatus } from '@/generated/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ContextValidatorService', () => {
  let validator: ContextValidatorService;
  let prisma: any;

  const mockOrg = {
    id: 'org-1',
    name: 'Test Org',
    code: 'TEST_ORG',
    status: OrganizationStatus.ACTIVE,
  };

  const mockBranch = {
    id: 'branch-1',
    organizationId: 'org-1',
    name: 'Test Branch',
    code: 'TEST_BRANCH',
    institutionType: 'K12',
    isActive: true,
    isDeleted: false,
  };

  const mockAy = {
    id: 'ay-1',
    branchId: 'branch-1',
    name: '2025-2026',
    startDate: new Date('2025-06-01'),
    endDate: new Date('2026-05-31'),
    isActive: true,
    isSelected: true,
    isLocked: false,
    isDeleted: false,
  };

  beforeEach(async () => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
      },
      branch: {
        findUnique: jest.fn(),
      },
      academicYear: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextValidatorService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    validator = module.get<ContextValidatorService>(ContextValidatorService);
  });

  describe('validateOrganization', () => {
    it('should validate active organization for super admin', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockOrg);
      const res = await validator.validateOrganization('org-1', 'user-1', RoleType.SUPER_ADMIN);
      expect(res).toEqual(mockOrg);
    });

    it('should throw NotFoundException when org does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      await expect(
        validator.validateOrganization('org-99', 'user-1', RoleType.SUPER_ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when org is inactive', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        ...mockOrg,
        status: 'INACTIVE',
      });
      await expect(
        validator.validateOrganization('org-1', 'user-1', RoleType.SUPER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when non-Super Admin tries cross-org access', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockOrg);
      await expect(
        validator.validateOrganization('org-1', 'user-1', RoleType.ORG_ADMIN, 'org-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('validateBranch', () => {
    it('should validate branch belonging to organization', async () => {
      prisma.branch.findUnique.mockResolvedValue(mockBranch);
      const res = await validator.validateBranch('branch-1', 'org-1', 'user-1', RoleType.ORG_ADMIN, 'org-1');
      expect(res).toEqual(mockBranch);
    });

    it('should throw NotFoundException when branch not found or deleted', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(
        validator.validateBranch('branch-99', 'org-1', 'user-1', RoleType.ORG_ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when branch does not belong to org', async () => {
      prisma.branch.findUnique.mockResolvedValue(mockBranch);
      await expect(
        validator.validateBranch('branch-1', 'org-2', 'user-1', RoleType.SUPER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when restricted user accesses unauthorized branch', async () => {
      prisma.branch.findUnique.mockResolvedValue(mockBranch);
      await expect(
        validator.validateBranch('branch-1', 'org-1', 'user-1', RoleType.STAFF, 'branch-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('validateAcademicYear', () => {
    it('should validate active academic year', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(mockAy);
      const res = await validator.validateAcademicYear('ay-1', 'branch-1');
      expect(res).toEqual(mockAy);
    });

    it('should throw BadRequestException when AY does not belong to branch', async () => {
      prisma.academicYear.findUnique.mockResolvedValue(mockAy);
      await expect(
        validator.validateAcademicYear('ay-1', 'branch-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
