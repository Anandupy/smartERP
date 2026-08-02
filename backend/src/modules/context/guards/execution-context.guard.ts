import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { AuthenticatedRequest } from '@/common/logger/request-context.middleware';
import { ContextResolverService } from '../services/context-resolver.service';
import { RoleType } from '@/generated/client';

@Injectable()
export class ExecutionContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly contextResolver: ContextResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Skip context resolution if no authenticated user is present
    if (!request.user || (!request.user.id && !(request.user as any).sub)) {
      return true;
    }

    const userId = request.user.id || (request.user as any).sub;
    const role = (request.user.role ||
      (request.context?.role as any)) as RoleType;

    const rawOrgHeader =
      (request.headers['x-organization-id'] as string) ||
      (request.headers['X-Organization-Id'] as string) ||
      null;

    const rawBranchHeader =
      (request.headers['x-branch-id'] as string) ||
      (request.headers['X-Branch-Id'] as string) ||
      null;

    const rawAyHeader =
      (request.headers['x-academic-year-id'] as string) ||
      (request.headers['X-Academic-Year-Id'] as string) ||
      null;

    const result = await this.contextResolver.resolveContext({
      user: {
        id: userId,
        role,
        organizationId: request.user.organizationId || null,
        branchId: request.user.branchId || null,
      },
      headers: {
        organizationId: rawOrgHeader,
        branchId: rawBranchHeader,
        academicYearId: rawAyHeader,
      },
      requestId: request.requestId || request.context?.requestId,
    });

    // Populate request.context execution scope cleanly
    if (!request.context) {
      request.context = {
        requestId: request.requestId || 'unknown',
        organizationId: result.context.organizationId,
        branchId: result.context.branchId,
        academicYearId: result.context.academicYearId,
        programId: null,
        departmentId: null,
        campusId: null,
        branch: result.context.branch || null,
        academicYear: result.context.academicYear || null,
      } as any;
    } else {
      request.context.organizationId = result.context.organizationId;
      request.context.branchId = result.context.branchId;
      request.context.academicYearId = result.context.academicYearId;
      (request.context as any).programId = null;
      (request.context as any).departmentId = null;
      (request.context as any).campusId = null;
      request.context.branch = result.context.branch || null;
      request.context.academicYear = result.context.academicYear || null;
    }

    return true;
  }
}
