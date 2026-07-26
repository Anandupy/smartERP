import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MaintenanceService } from '@/modules/maintenance/maintenance.service';
import { MAINTENANCE_FEATURE_KEY } from '../decorators/maintenance.decorator';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly maintenanceService: MaintenanceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Retrieve feature metadata from route handler or controller class
    const featureName = this.reflector.getAllAndOverride<string>(
      MAINTENANCE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requestContext = request.context || {};
    const userId = requestContext.userId || request.user?.id || request.user?.sub || null;
    const role = requestContext.role || request.user?.role || null;
    const organizationId = requestContext.organizationId || request.user?.organizationId || null;
    const branchId =
      requestContext.branchId ||
      request.headers['x-branch-id'] ||
      request.headers['X-Branch-Id'] ||
      request.user?.branchId ||
      null;

    await this.maintenanceService.checkMaintenance(
      { userId, role, organizationId, branchId },
      request.method,
      request.path || request.url,
      featureName,
    );

    return true;
  }
}
