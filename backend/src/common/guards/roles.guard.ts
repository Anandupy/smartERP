import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/role.enum';

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
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    
    // Get role and userId from user object (JWT) or headers (simulation)
    const user = request.user;
    const role = (user?.role || request.headers['x-role']) as UserRole;
    const userId = user?.id || request.headers['x-user-id'];

    if (!role) {
      throw new ForbiddenException('No role provided');
    }

    if (!Object.values(UserRole).includes(role)) {
      throw new ForbiddenException('Invalid role provided');
    }

    // Check hierarchy
    const userRoleWeight = this.roleHierarchy[role];
    const hasRole = requiredRoles.some((r) => this.roleHierarchy[r] <= userRoleWeight);
    
    if (!hasRole) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    // Ensure userId is attached for audit
    request.userId = userId;

    return true;
  }
}
