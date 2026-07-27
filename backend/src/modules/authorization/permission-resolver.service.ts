import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RoleType, OverrideType } from '@prisma/client';
import { LoggerService } from '@/common/logger/logger.service';

export interface ResolvedPermissions {
  userId: string;
  role: RoleType;
  effectivePermissions: Set<string>;
  rolePermissions: string[];
  userGrants: string[];
  userDenies: string[];
  isSuperAdmin: boolean;
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
   * Resolve effective permissions for a user given their ID and Role.
   * Logic: (Role Permissions + User Grants) - User Denies
   * SUPER_ADMIN automatically inherits all active system permissions.
   */
  async resolvePermissions(
    userId: string,
    role: RoleType,
  ): Promise<ResolvedPermissions> {
    this.logger.log(`Resolving permissions for user=${userId}, role=${role}`);

    const isSuperAdmin = role === RoleType.SUPER_ADMIN;

    // 1. Fetch user overrides
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: { userId },
      include: {
        permission: true,
      },
    });

    const userGrants = overrides
      .filter((o) => o.type === OverrideType.GRANT && o.permission.isActive)
      .map((o) => o.permission.name);

    const userDenies = overrides
      .filter((o) => o.type === OverrideType.DENY && o.permission.isActive)
      .map((o) => o.permission.name);

    let rolePermissions: string[] = [];

    if (isSuperAdmin) {
      // SUPER_ADMIN gets all active permissions in system
      const allActive = await this.prisma.permission.findMany({
        where: { isActive: true },
        select: { name: true },
      });
      rolePermissions = allActive.map((p) => p.name);
    } else {
      // Fetch role permissions
      const rolePerms = await this.prisma.rolePermission.findMany({
        where: {
          role,
          permission: {
            isActive: true,
          },
        },
        include: {
          permission: true,
        },
      });
      rolePermissions = rolePerms.map((rp) => rp.permission.name);
    }

    // 2. Build effective set
    // Start with role permissions
    const effectiveSet = new Set<string>(rolePermissions);

    // Add user grants
    for (const grant of userGrants) {
      effectiveSet.add(grant);
    }

    // Remove user denies (Deny overrides Role + Grants)
    for (const deny of userDenies) {
      effectiveSet.delete(deny);
    }

    this.logger.log(
      `Resolved ${effectiveSet.size} permissions for user=${userId} (Role: ${rolePermissions.length}, Grants: ${userGrants.length}, Denies: ${userDenies.length})`,
    );

    return {
      userId,
      role,
      effectivePermissions: effectiveSet,
      rolePermissions,
      userGrants,
      userDenies,
      isSuperAdmin,
    };
  }

  /**
   * Extension point for future Redis caching resolution
   */
  async resolvePermissionsWithCache(
    userId: string,
    role: RoleType,
  ): Promise<ResolvedPermissions> {
    // Phase 1 fallback directly to DB resolution
    // Phase 2 will check Redis cache key `auth:perm:${userId}` before DB fetch
    return this.resolvePermissions(userId, role);
  }
}
