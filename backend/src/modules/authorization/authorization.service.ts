import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { PermissionResolverService } from './permission-resolver.service';
import { RoleType, OverrideType } from '@prisma/client';
import { LoggerService } from '@/common/logger/logger.service';
import {
  RolePermissionsUpdatedEvent,
  UserPermissionOverrideUpdatedEvent,
  UserPermissionOverrideDeletedEvent,
  PermissionDeniedEvent,
} from './events/authorization.events';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly eventBus: EventBus,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(AuthorizationService.name);
  }

  /**
   * Main permission authorization check
   */
  async canUserAccess(
    userId: string,
    role: RoleType,
    requiredPermissions: string[],
    mode: 'ALL' | 'ANY' = 'ALL',
  ): Promise<{ allowed: boolean; missingPermissions: string[] }> {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return { allowed: true, missingPermissions: [] };
    }

    const { effectivePermissions } =
      await this.permissionResolver.resolvePermissions(userId, role);

    const missingPermissions = requiredPermissions.filter(
      (perm) => !effectivePermissions.has(perm),
    );

    let allowed = false;
    if (mode === 'ALL') {
      allowed = missingPermissions.length === 0;
    } else {
      // ANY mode
      allowed = requiredPermissions.some((perm) =>
        effectivePermissions.has(perm),
      );
    }

    if (!allowed) {
      this.logger.warn(
        `Permission DENIED for user=${userId}, role=${role}. Required: [${requiredPermissions.join(
          ', ',
        )}], Missing: [${missingPermissions.join(', ')}]`,
      );

      await this.eventBus.publish(
        new PermissionDeniedEvent({
          userId,
          role,
          requiredPermissions,
          missingPermissions,
        }),
      );
    } else {
      this.logger.log(
        `Permission GRANTED for user=${userId}, role=${role}. Checked: [${requiredPermissions.join(
          ', ',
        )}]`,
      );
    }

    return { allowed, missingPermissions };
  }

  /**
   * Get user's effective permission list
   */
  async getUserEffectivePermissions(userId: string, role: RoleType) {
    const resolved = await this.permissionResolver.resolvePermissions(
      userId,
      role,
    );

    return {
      userId,
      role,
      effectivePermissions: Array.from(resolved.effectivePermissions),
      rolePermissions: resolved.rolePermissions,
      userGrants: resolved.userGrants,
      userDenies: resolved.userDenies,
      isSuperAdmin: resolved.isSuperAdmin,
    };
  }

  /**
   * Get permissions assigned to a specific role
   */
  async getRolePermissions(role: RoleType) {
    const mappings = await this.prisma.rolePermission.findMany({
      where: { role },
      include: {
        permission: {
          include: { category: true },
        },
      },
    });

    return mappings.map((m) => m.permission);
  }

  /**
   * Assign/replace permissions for a role
   */
  async assignPermissionsToRole(
    role: RoleType,
    permissionIds: string[],
    updatedBy?: string,
  ) {
    // Verify permissions exist
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permission IDs are invalid');
    }

    // Execute in transaction: clear existing & insert new
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role } });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((pId) => ({
            role,
            permissionId: pId,
          })),
        });
      }
    });

    const permissionNames = permissions.map((p) => p.name);

    await this.eventBus.publish(
      new RolePermissionsUpdatedEvent({
        role,
        permissionIds,
        permissionNames,
        updatedBy,
      }),
    );

    this.logger.log(
      `Assigned ${permissionIds.length} permissions to role=${role}`,
    );

    return { role, count: permissionIds.length, permissions: permissionNames };
  }

  /**
   * Get user's direct permission overrides
   */
  async getUserOverrides(userId: string) {
    return this.prisma.userPermissionOverride.findMany({
      where: { userId },
      include: {
        permission: {
          include: { category: true },
        },
      },
    });
  }

  /**
   * Set a direct user permission override (GRANT or DENY)
   */
  async setUserOverride(
    userId: string,
    permissionId: string,
    type: OverrideType,
    reason?: string,
    createdBy?: string,
  ) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Verify permission exists
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });
    if (!permission) {
      throw new NotFoundException(
        `Permission with ID "${permissionId}" not found`,
      );
    }

    // Upsert override
    const override = await this.prisma.userPermissionOverride.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
      update: {
        type,
        reason,
        updatedBy: createdBy,
      },
      create: {
        userId,
        permissionId,
        type,
        reason,
        createdBy,
      },
      include: {
        permission: true,
      },
    });

    await this.eventBus.publish(
      new UserPermissionOverrideUpdatedEvent({
        userId,
        permissionId,
        permissionName: permission.name,
        type,
        reason,
        createdBy,
      }),
    );

    this.logger.log(
      `Set user override for user=${userId}, permission=${permission.name}, type=${type}`,
    );

    return override;
  }

  /**
   * Delete a direct user permission override
   */
  async removeUserOverride(userId: string, permissionId: string) {
    const existing = await this.prisma.userPermissionOverride.findUnique({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `User permission override not found for user "${userId}" and permission "${permissionId}"`,
      );
    }

    await this.prisma.userPermissionOverride.delete({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
    });

    await this.eventBus.publish(
      new UserPermissionOverrideDeletedEvent({
        userId,
        permissionId,
      }),
    );

    this.logger.log(
      `Removed user override for user=${userId}, permissionId=${permissionId}`,
    );

    return { success: true, message: 'Override removed' };
  }

  // --- Extension Points for Future Phases ---

  /**
   * Future Extension: Menu Authorization Integration
   */
  async getAuthorizedMenuItems(userId: string, role: RoleType) {
    const effective = await this.getUserEffectivePermissions(userId, role);
    // Future: Filter dynamic menu structure against effective.effectivePermissions
    return {
      userId,
      effectivePermissions: effective.effectivePermissions,
      menu: [],
    };
  }

  /**
   * Future Extension: HR & Designation Authorization Integration
   */
  async resolveHRPermissions(userId: string, designationId?: string) {
    // Future: Combine Designation permissions with User Effective Permissions
    return { userId, designationId, hrPermissions: [] };
  }
}
