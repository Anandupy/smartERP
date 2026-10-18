import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { RoleType, OverrideType } from '@/generated/client';
import { LoggerService } from '@/common/logger/logger.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import { RequestContext } from '@/common/logger/request-context.middleware';
import { assertOrganizationInScope } from '@/common/scope/resource-scope';
import {
  RolePermissionsUpdatedEvent,
  UserPermissionOverrideUpdatedEvent,
  UserPermissionOverrideDeletedEvent,
} from '@/common/events/authorization.events';

@Injectable()
export class PermissionAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly logger: LoggerService,
    private readonly requestContextService: RequestContextService,
  ) {
    this.logger.setContext(PermissionAssignmentService.name);
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
   * Assign or synchronize permissions for a role with exact state diffing and event publishing
   */
  async assignPermissionsToRole(
    role: RoleType,
    permissionIds: string[],
    updatedBy?: string,
  ) {
    const context = this.requestContextService.getContext();

    // 1. Fetch current role permissions
    const existingMappings = await this.prisma.rolePermission.findMany({
      where: { role },
      include: { permission: true },
    });
    const previousPermissions = existingMappings.map((m) => m.permission.name);
    const previousIds = new Set(existingMappings.map((m) => m.permissionId));

    // 2. Validate new permission IDs
    const newPermissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (newPermissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permission IDs are invalid');
    }

    const currentPermissions = newPermissions.map((p) => p.name);
    const targetIds = new Set(permissionIds);

    // 3. Compute diffs
    const addedPermissions = newPermissions
      .filter((p) => !previousIds.has(p.id))
      .map((p) => p.name);

    const removedPermissions = existingMappings
      .filter((m) => !targetIds.has(m.permissionId))
      .map((m) => m.permission.name);

    // 4. Atomic transaction update
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

    // 5. Publish domain event for Audit & event handlers
    await this.eventBus.publish(
      new RolePermissionsUpdatedEvent({
        role,
        addedPermissions,
        removedPermissions,
        currentPermissions,
        previousPermissions,
        updatedBy: updatedBy || context?.userId || undefined,
        organizationId: context?.organizationId || undefined,
        branchId: context?.branchId || undefined,
      }),
    );

    this.logger.log(
      `Synchronized role=${role} permissions: +${addedPermissions.length}, -${removedPermissions.length}, Total=${currentPermissions.length}`,
    );

    return {
      role,
      count: currentPermissions.length,
      addedPermissions,
      removedPermissions,
      permissions: currentPermissions,
    };
  }

  /**
   * Alias for assignPermissionsToRole
   */
  async syncRolePermissions(
    role: RoleType,
    permissionIds: string[],
    updatedBy?: string,
  ) {
    return this.assignPermissionsToRole(role, permissionIds, updatedBy);
  }

  /**
   * Get direct permission overrides for a user
   */
  async getUserOverrides(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (user) {
      this.assertUserInScope(user, this.requestContextService.getContext());
    }

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
   * Grant a direct user permission override
   */
  async grantUserOverride(
    userId: string,
    permissionId: string,
    reason?: string,
    performedBy?: string,
  ) {
    return this.setUserOverride(
      userId,
      permissionId,
      OverrideType.GRANT,
      reason,
      performedBy,
    );
  }

  /**
   * Deny a direct user permission override
   */
  async denyUserOverride(
    userId: string,
    permissionId: string,
    reason?: string,
    performedBy?: string,
  ) {
    return this.setUserOverride(
      userId,
      permissionId,
      OverrideType.DENY,
      reason,
      performedBy,
    );
  }

  /**
   * Set or update a user permission override (GRANT or DENY)
   */
  async setUserOverride(
    userId: string,
    permissionId: string,
    type: OverrideType,
    reason?: string,
    performedBy?: string,
  ) {
    const context = this.requestContextService.getContext();

    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }
    this.assertUserInScope(user, context);

    // Verify permission exists
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });
    if (!permission) {
      throw new NotFoundException(
        `Permission with ID "${permissionId}" not found`,
      );
    }

    // Fetch existing override to track previous state
    const existing = await this.prisma.userPermissionOverride.findUnique({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
    });

    const previousState = existing ? existing.type : null;

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
        updatedBy: performedBy || context?.userId || undefined,
      },
      create: {
        userId,
        permissionId,
        type,
        reason,
        createdBy: performedBy || context?.userId || undefined,
      },
      include: {
        permission: true,
      },
    });

    // Publish domain event
    await this.eventBus.publish(
      new UserPermissionOverrideUpdatedEvent({
        userId,
        permissionId,
        permissionName: permission.name,
        type,
        previousState,
        newState: type,
        reason,
        performedBy: performedBy || context?.userId || undefined,
        organizationId: context?.organizationId || undefined,
        branchId: context?.branchId || undefined,
      }),
    );

    this.logger.log(
      `Updated user override: user=${userId}, permission=${permission.name}, type=${type}, previousState=${previousState}`,
    );

    return override;
  }

  /**
   * Delete/remove a user permission override
   */
  async removeUserOverride(
    userId: string,
    permissionId: string,
    removedBy?: string,
  ) {
    const context = this.requestContextService.getContext();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (user) {
      this.assertUserInScope(user, context);
    }

    const existing = await this.prisma.userPermissionOverride.findUnique({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
      include: {
        permission: true,
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
        permissionName: existing.permission.name,
        previousOverride: existing.type,
        removedBy: removedBy || context?.userId || undefined,
        organizationId: context?.organizationId || undefined,
        branchId: context?.branchId || undefined,
      }),
    );

    this.logger.log(
      `Removed user override for user=${userId}, permission=${existing.permission.name}`,
    );

    return { success: true, message: 'Override successfully removed' };
  }

  /**
   * Overrides are keyed by user id alone, so without this an ORG_ADMIN could
   * read, grant or deny permissions for a user in another organization —
   * including that organization's own admins. SUPER_ADMIN and internal
   * callers (no request context) are unrestricted, as elsewhere.
   */
  private assertUserInScope(
    user: { organizationId: string | null },
    context: RequestContext | undefined,
  ): void {
    assertOrganizationInScope(context, user.organizationId);
  }
}
