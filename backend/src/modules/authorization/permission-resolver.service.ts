import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RoleType, OverrideType } from '@/generated/client';
import { LoggerService } from '@/common/logger/logger.service';

export interface ResolvedPermissions {
  userId: string;
  role: RoleType;
  effectivePermissions: Set<string>;
  rolePermissions: string[];
  userGrants: string[];
  userDenies: string[];
  isSuperAdmin: boolean;
  resolutionDurationMs: number;
}

@Injectable()
export class PermissionResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PermissionResolverService.name);
  }

  /**
   * Centralized Permission Resolution Engine
   *
   * Precedence Algorithm:
   * 1. Role Permissions (Active permissions mapped to user's assigned role)
   * 2. SUPER_ADMIN Bypass (Inherits all active system permissions)
   * 3. User Grants (Direct UserPermissionOverride with type GRANT)
   * 4. User Denies (Direct UserPermissionOverride with type DENY - overrides Role & Grants)
   * 5. Final Effective Permission Set (Immutable Set of allowed permission names)
   */
  async resolvePermissions(
    userId: string,
    role: RoleType,
  ): Promise<ResolvedPermissions> {
    const startTime = process.hrtime.bigint();

    const isSuperAdmin = role === RoleType.SUPER_ADMIN;

    // 1. Batch query user overrides with active permission and category filter
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: {
        userId,
        permission: {
          isActive: true,
          category: {
            isActive: true,
          },
        },
      },
      include: {
        permission: true,
      },
    });

    const userGrants = Array.from(
      new Set(
        overrides
          .filter((o) => o.type === OverrideType.GRANT)
          .map((o) => o.permission.name),
      ),
    );

    const userDenies = Array.from(
      new Set(
        overrides
          .filter((o) => o.type === OverrideType.DENY)
          .map((o) => o.permission.name),
      ),
    );

    let rolePermissions: string[] = [];

    if (isSuperAdmin) {
      // SUPER_ADMIN gets all active permissions in active categories
      const allActive = await this.prisma.permission.findMany({
        where: {
          isActive: true,
          category: {
            isActive: true,
          },
        },
        select: { name: true },
      });
      rolePermissions = allActive.map((p) => p.name);
    } else {
      // Fetch role permissions for active permissions and active categories
      const rolePerms = await this.prisma.rolePermission.findMany({
        where: {
          role,
          permission: {
            isActive: true,
            category: {
              isActive: true,
            },
          },
        },
        include: {
          permission: true,
        },
      });
      rolePermissions = rolePerms.map((rp) => rp.permission.name);
    }

    // 2. Build effective set (Role -> Grants -> Denies)
    const effectiveSet = new Set<string>(rolePermissions);

    // Apply User Grants
    for (const grant of userGrants) {
      effectiveSet.add(grant);
    }

    // Apply User Denies (Deny takes absolute precedence)
    for (const deny of userDenies) {
      effectiveSet.delete(deny);
    }

    const endTime = process.hrtime.bigint();
    const resolutionDurationMs = Number(endTime - startTime) / 1_000_000;

    // Execution time & metrics logging
    if (resolutionDurationMs > 100) {
      this.logger.warn(
        `🐢 [SLOW PERMISSION RESOLUTION] Resolved permissions for user=${userId} in ${resolutionDurationMs.toFixed(
          2,
        )}ms`,
      );
    } else {
      this.logger.log(
        `Resolved ${effectiveSet.size} permissions for user=${userId} (Role: ${role}, Duration: ${resolutionDurationMs.toFixed(
          2,
        )}ms)`,
      );
    }

    return {
      userId,
      role,
      effectivePermissions: effectiveSet,
      rolePermissions,
      userGrants,
      userDenies,
      isSuperAdmin,
      resolutionDurationMs,
    };
  }

  // --- Clean Extension Hooks for Future Phases ---

  /**
   * Extension Hook: Future Redis Permission Caching (Phase 3)
   */
  async resolvePermissionsWithCache(
    userId: string,
    role: RoleType,
  ): Promise<ResolvedPermissions> {
    return this.resolvePermissions(userId, role);
  }

  /**
   * Extension Hook: Future HR / Designation Permissions Integration
   */
  async resolveHRPermissions(
    userId: string,
    designationId?: string,
  ): Promise<string[]> {
    this.logger.debug(
      `HR permissions extension hook evaluated for user=${userId}, designation=${designationId}`,
    );
    return [];
  }

  /**
   * Extension Hook: Future Permission Profiles Integration
   */
  async resolvePermissionProfiles(
    userId: string,
    profileIds?: string[],
  ): Promise<string[]> {
    this.logger.debug(
      `Permission profiles extension hook evaluated for user=${userId}, profiles=${profileIds?.join(',')}`,
    );
    return [];
  }
}
