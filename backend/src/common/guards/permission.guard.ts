import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSION_KEY,
  PERMISSION_MODE_KEY,
  PermissionMode,
} from '../decorators/permission.decorator';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { RoleType } from '@/generated/client';
import { LoggerService } from '../logger/logger.service';
import { AuthenticatedRequest } from '../logger/request-context.middleware';

/**
 * Enforces fine-grained permissions declared by `@RequirePermission()`.
 *
 * Read-only with respect to the request context. It must run after
 * `ExecutionContextGuard` so that a permission decision is never made against
 * an unresolved scope — see `docs/core/guard-pipeline.md`.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PermissionGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permission requirement decorator is specified on route/class, pass through
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const mode =
      this.reflector.getAllAndOverride<PermissionMode>(PERMISSION_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'ALL';

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Identity comes from the resolved context, which ExecutionContextGuard
    // populates before this guard runs.
    const userId = request.context?.userId;
    const role = request.context?.role as RoleType;

    if (!userId || !role) {
      this.logger.warn(
        'PermissionGuard check failed: missing userId or role in request context',
      );
      throw new ForbiddenException(
        'User is not authenticated or lacks assigned role',
      );
    }

    // Evaluate permissions via AuthorizationService
    const { allowed, missingPermissions } =
      await this.authorizationService.canUserAccess(
        userId,
        role,
        requiredPermissions,
        mode,
      );

    if (!allowed) {
      throw new ForbiddenException(
        `Access denied. Required permission(s): [${missingPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}
