import { Injectable } from '@nestjs/common';
import { PermissionResolverService } from './permission-resolver.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { RoleType } from '@prisma/client';
import { LoggerService } from '@/common/logger/logger.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import { PermissionDeniedEvent } from './events/authorization.events';

export interface AuthorizationAccessResult {
  allowed: boolean;
  missingPermissions: string[];
}

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly permissionResolver: PermissionResolverService,
    private readonly eventBus: EventBus,
    private readonly logger: LoggerService,
    private readonly requestContextService: RequestContextService,
  ) {
    this.logger.setContext(AuthorizationService.name);
  }

  /**
   * Check if a user possesses a specific permission
   */
  async hasPermission(
    userId: string,
    role: RoleType,
    permissionName: string,
  ): Promise<boolean> {
    const { effectivePermissions } =
      await this.permissionResolver.resolvePermissions(userId, role);
    return effectivePermissions.has(permissionName);
  }

  /**
   * Check if a user possesses at least one of the specified permissions (ANY mode)
   */
  async hasAnyPermission(
    userId: string,
    role: RoleType,
    permissions: string[],
  ): Promise<boolean> {
    if (!permissions || permissions.length === 0) return true;

    const { effectivePermissions } =
      await this.permissionResolver.resolvePermissions(userId, role);

    return permissions.some((perm) => effectivePermissions.has(perm));
  }

  /**
   * Check if a user possesses all of the specified permissions (ALL mode)
   */
  async hasAllPermissions(
    userId: string,
    role: RoleType,
    permissions: string[],
  ): Promise<boolean> {
    if (!permissions || permissions.length === 0) return true;

    const { effectivePermissions } =
      await this.permissionResolver.resolvePermissions(userId, role);

    return permissions.every((perm) => effectivePermissions.has(perm));
  }

  /**
   * Façade method for authorization evaluation decisions across ERP modules
   */
  async canUserAccess(
    userId: string,
    role: RoleType,
    requiredPermissions: string[],
    mode: 'ALL' | 'ANY' = 'ALL',
    httpContext?: { route?: string; httpMethod?: string },
  ): Promise<AuthorizationAccessResult> {
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
      allowed = requiredPermissions.some((perm) =>
        effectivePermissions.has(perm),
      );
    }

    if (!allowed) {
      const context = this.requestContextService.getContext();

      this.logger.warn(
        `Permission DENIED for user=${userId}, role=${role}. Required: [${requiredPermissions.join(
          ', ',
        )}], Missing: [${missingPermissions.join(', ')}]`,
      );

      // Publish security audit event for access failure
      await this.eventBus.publish(
        new PermissionDeniedEvent({
          userId,
          role,
          requiredPermissions,
          missingPermissions,
          route: httpContext?.route,
          httpMethod: httpContext?.httpMethod,
          organizationId: context?.organizationId || undefined,
          branchId: context?.branchId || undefined,
          academicYearId: context?.academicYearId || undefined,
          requestId: context?.requestId || undefined,
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
      resolutionDurationMs: resolved.resolutionDurationMs,
    };
  }
}
