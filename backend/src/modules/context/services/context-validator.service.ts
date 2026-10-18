import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RoleType, OrganizationStatus } from '@/generated/client';

export interface ValidatedOrganization {
  id: string;
  name: string;
  code: string;
  status: OrganizationStatus;
}

export interface ValidatedBranch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  institutionType: string;
  isActive: boolean;
  isDeleted: boolean;
}

export interface ValidatedAcademicYear {
  id: string;
  branchId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  isSelected: boolean;
  isLocked: boolean;
  isDeleted: boolean;
}

export interface FullValidationResult {
  organization: ValidatedOrganization;
  branch: ValidatedBranch;
  academicYear: ValidatedAcademicYear;
}

@Injectable()
export class ContextValidatorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate Organization exists, is active, and user has access
   */
  async validateOrganization(
    organizationId: string,
    userId: string,
    role: RoleType,
    userOrgId?: string | null,
  ): Promise<ValidatedOrganization> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException(
        `Organization '${organizationId}' not found.`,
      );
    }

    if (org.status !== OrganizationStatus.ACTIVE) {
      throw new BadRequestException(`Organization '${org.name}' is inactive.`);
    }

    // User access check: non-SUPER_ADMIN must match assigned organizationId.
    // A non-SUPER_ADMIN with no organization is refused rather than waved
    // through — discovery offers such a user nothing, so a header must not be
    // able to grant what discovery withholds.
    if (role !== RoleType.SUPER_ADMIN && (!userOrgId || userOrgId !== org.id)) {
      throw new ForbiddenException(
        `User does not have access to organization '${organizationId}'.`,
      );
    }

    return org;
  }

  /**
   * Validate Branch exists, belongs to Organization, is active, and user has access
   */
  async validateBranch(
    branchId: string,
    organizationId: string,
    userId: string,
    role: RoleType,
    userBranchId?: string | null,
  ): Promise<ValidatedBranch> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch || branch.isDeleted) {
      throw new NotFoundException(`Branch '${branchId}' not found.`);
    }

    if (branch.organizationId !== organizationId) {
      throw new BadRequestException(
        `Branch '${branch.name}' does not belong to organization '${organizationId}'.`,
      );
    }

    if (!branch.isActive) {
      throw new BadRequestException(`Branch '${branch.name}' is inactive.`);
    }

    // User access check: restricted roles must match assigned branchId if present
    if (
      role !== RoleType.SUPER_ADMIN &&
      role !== RoleType.ORG_ADMIN &&
      userBranchId &&
      userBranchId !== branch.id
    ) {
      throw new ForbiddenException(
        `User does not have access to branch '${branchId}'.`,
      );
    }

    return branch;
  }

  /**
   * Validate Academic Year exists, belongs to Branch, and is active/not deleted
   */
  async validateAcademicYear(
    academicYearId: string,
    branchId: string,
  ): Promise<ValidatedAcademicYear> {
    const ay = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });

    if (!ay || ay.isDeleted) {
      throw new NotFoundException(
        `Academic Year '${academicYearId}' not found.`,
      );
    }

    if (ay.branchId !== branchId) {
      throw new BadRequestException(
        `Academic Year '${ay.name}' does not belong to branch '${branchId}'.`,
      );
    }

    if (!ay.isActive && !ay.isSelected) {
      throw new BadRequestException(`Academic Year '${ay.name}' is inactive.`);
    }

    return ay;
  }

  /**
   * The organization a branch belongs to, or `null` if there is no such branch.
   *
   * A lookup, not a check: the caller passes the result through
   * `validateOrganization` and `validateBranch`, which is where existence,
   * activity and user access are decided. Returning `null` rather than throwing
   * keeps an unknown id on the ordinary resolution path instead of turning it
   * into a different error than it would otherwise have been.
   */
  async findBranchOrganizationId(branchId: string): Promise<string | null> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { organizationId: true, isDeleted: true },
    });

    return branch && !branch.isDeleted ? branch.organizationId : null;
  }

  /** The branch an academic year belongs to. Same contract as above. */
  async findAcademicYearBranchId(
    academicYearId: string,
  ): Promise<string | null> {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { branchId: true, isDeleted: true },
    });

    return academicYear && !academicYear.isDeleted
      ? academicYear.branchId
      : null;
  }

  /**
   * Full pipeline validation of Org, Branch, and Academic Year
   */
  async validateFullContext(
    organizationId: string,
    branchId: string,
    academicYearId: string,
    userId: string,
    role: RoleType,
    userOrgId?: string | null,
    userBranchId?: string | null,
  ): Promise<FullValidationResult> {
    const organization = await this.validateOrganization(
      organizationId,
      userId,
      role,
      userOrgId,
    );

    const branch = await this.validateBranch(
      branchId,
      organization.id,
      userId,
      role,
      userBranchId,
    );

    const academicYear = await this.validateAcademicYear(
      academicYearId,
      branch.id,
    );

    return {
      organization,
      branch,
      academicYear,
    };
  }
}
