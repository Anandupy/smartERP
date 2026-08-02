import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/role.enum';
import { AuthenticatedRequest } from '../logger/request-context.middleware';

/**
 * Enforces the coarse role hierarchy declared by `@Roles()`.
 *
 * Read-only with respect to the request context: identity and tenant scope are
 * owned by `ExecutionContextGuard`. Cross-organization and cross-branch access
 * is rejected by `ContextValidatorService` during context resolution, so this
 * guard no longer silently rewrites the branch scope to defend against header
 * spoofing.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  private readonly roleHierarchy: Record<UserRole, number> = {
    [UserRole.SUPER_ADMIN]: 5,
    [UserRole.ORG_ADMIN]: 4,
    [UserRole.BRANCH_ADMIN]: 3,
    [UserRole.STAFF]: 2,
    [UserRole.STUDENT]: 1,
    [UserRole.PARENT]: 1,
  };

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // The role decision uses the resolved context, which ExecutionContextGuard
    // populates before this guard runs.
    const role = request.context?.role as UserRole;

    if (!role) {
      throw new ForbiddenException('No role provided');
    }

    if (!Object.values(UserRole).includes(role)) {
      throw new ForbiddenException('Invalid role provided');
    }

    // Check hierarchy
    const userRoleWeight = this.roleHierarchy[role];
    const hasRole = requiredRoles.some(
      (r) => this.roleHierarchy[r] <= userRoleWeight,
    );

    if (!hasRole) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }
}
