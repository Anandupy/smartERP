import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MaintenanceService } from '@/modules/maintenance/maintenance.service';
import { MAINTENANCE_FEATURE_KEY } from '../decorators/maintenance.decorator';
import { AuthenticatedRequest } from '../logger/request-context.middleware';

/**
 * Blocks requests that fall under an active maintenance rule.
 *
 * Reads the scope exclusively from the resolved request context. The previous
 * fallback to raw `x-branch-id` / `x-organization-id` headers is gone: on an
 * authenticated request the context already holds the validated scope, and on a
 * public request those headers are unauthenticated input that must not select
 * which maintenance rule applies. Public requests are therefore matched against
 * GLOBAL, MODULE and FEATURE rules only.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly maintenanceService: MaintenanceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Retrieve feature metadata from route handler or controller class
    const featureName = this.reflector.getAllAndOverride<string>(
      MAINTENANCE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requestContext = request.context;

    await this.maintenanceService.checkMaintenance(
      {
        userId: requestContext?.userId ?? null,
        role: requestContext?.role ?? null,
        organizationId: requestContext?.organizationId ?? null,
        branchId: requestContext?.branchId ?? null,
      },
      request.method,
      request.path || request.url,
      featureName,
    );

    return true;
  }
}
