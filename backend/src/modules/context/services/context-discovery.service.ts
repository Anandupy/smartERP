import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RoleType, OrganizationStatus } from '@/generated/client';
import {
  ContextDiscoveryResult,
  AvailableOrganizationItem,
  AvailableBranchItem,
  AvailableAcademicYearItem,
} from '../interfaces/execution-context.interface';

@Injectable()
export class ContextDiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Discover available Organizations, Branches, and Academic Years for a given user & role.
   * Optionally filter by target organizationId or branchId if already specified.
   */
  async discoverContexts(
    userId: string,
    role: RoleType,
    userOrgId?: string | null,
    userBranchId?: string | null,
    filterOrgId?: string | null,
    filterBranchId?: string | null,
  ): Promise<ContextDiscoveryResult> {
    // 1. Discover Organizations
    let availableOrganizations: AvailableOrganizationItem[] = [];

    if (role === RoleType.SUPER_ADMIN) {
      const orgs = await this.prisma.organization.findMany({
        where: { status: OrganizationStatus.ACTIVE },
        select: { id: true, name: true, code: true, status: true },
        orderBy: { name: 'asc' },
      });
      availableOrganizations = orgs;
    } else if (userOrgId) {
      const org = await this.prisma.organization.findFirst({
        where: { id: userOrgId, status: OrganizationStatus.ACTIVE },
        select: { id: true, name: true, code: true, status: true },
      });
      if (org) {
        availableOrganizations = [org];
      }
    }

    // 2. Discover Branches
    let availableBranches: AvailableBranchItem[] = [];
    const targetOrgIds = filterOrgId
      ? [filterOrgId]
      : availableOrganizations.map((o) => o.id);

    if (targetOrgIds.length > 0) {
      if (role === RoleType.SUPER_ADMIN || role === RoleType.ORG_ADMIN) {
        const branches = await this.prisma.branch.findMany({
          where: {
            organizationId: { in: targetOrgIds },
            isActive: true,
            isDeleted: false,
          },
          select: {
            id: true,
            organizationId: true,
            name: true,
            code: true,
            institutionType: true,
            isActive: true,
          },
          orderBy: { name: 'asc' },
        });
        availableBranches = branches;
      } else if (userBranchId) {
        const branch = await this.prisma.branch.findFirst({
          where: {
            id: userBranchId,
            organizationId: { in: targetOrgIds },
            isActive: true,
            isDeleted: false,
          },
          select: {
            id: true,
            organizationId: true,
            name: true,
            code: true,
            institutionType: true,
            isActive: true,
          },
        });
        if (branch) {
          availableBranches = [branch];
        }
      } else {
        // Fallback for staff/student/parent if branchId on user is null: discover all active branches for user's org
        const branches = await this.prisma.branch.findMany({
          where: {
            organizationId: { in: targetOrgIds },
            isActive: true,
            isDeleted: false,
          },
          select: {
            id: true,
            organizationId: true,
            name: true,
            code: true,
            institutionType: true,
            isActive: true,
          },
          orderBy: { name: 'asc' },
        });
        availableBranches = branches;
      }
    }

    // 3. Discover Academic Years
    let availableAcademicYears: AvailableAcademicYearItem[] = [];
    const targetBranchIds = filterBranchId
      ? [filterBranchId]
      : availableBranches.map((b) => b.id);

    if (targetBranchIds.length > 0) {
      const academicYears = await this.prisma.academicYear.findMany({
        where: {
          branchId: { in: targetBranchIds },
          isDeleted: false,
        },
        select: {
          id: true,
          branchId: true,
          name: true,
          startDate: true,
          endDate: true,
          isActive: true,
          isSelected: true,
          isLocked: true,
        },
        orderBy: [
          { isSelected: 'desc' },
          { isActive: 'desc' },
          { startDate: 'desc' },
        ],
      });
      availableAcademicYears = academicYears;
    }

    return {
      availableOrganizations,
      availableBranches,
      availableAcademicYears,
    };
  }
}
