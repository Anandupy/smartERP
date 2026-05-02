import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const roleHeader = request.headers['x-role'];

    if (!roleHeader) {
      throw new ForbiddenException('Role header (x-role) is missing');
    }

    const userRole = roleHeader.toString().toUpperCase() as Role;

    if (!Object.values(Role).includes(userRole)) {
      throw new ForbiddenException(
        `Invalid role provided in header: ${roleHeader}`,
      );
    }

    const hasPermission = requiredRoles.includes(userRole);

    if (!hasPermission) {
      throw new ForbiddenException(
        `Your role (${userRole}) does not have permission to access this resource`,
      );
    }

    return true;
  }
}
