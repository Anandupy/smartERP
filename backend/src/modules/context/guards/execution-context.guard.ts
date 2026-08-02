import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '@/common/logger/request-context.middleware';
import { RequestContextService } from '@/common/logger/request-context.service';
import { ContextResolverService } from '../services/context-resolver.service';
import { WorkspaceSetupService } from '@/modules/workspace/setup/workspace-setup.service';
import { RoleType } from '@/generated/client';

/**
 * The sole owner of the request execution scope.
 *
 * No other guard, interceptor or service writes identity or tenant scope onto
 * the request context; the `RequestContext` type is read-only everywhere else,
 * so an attempt to do so fails to compile. See
 * `docs/core/execution-context.md` for the full lifecycle.
 */
@Injectable()
export class ExecutionContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly contextResolver: ContextResolverService,
    private readonly setupService: WorkspaceSetupService,
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
    const user = request.user;
    const userId = this.resolveUserId(user);

    // Nothing to resolve without an authenticated principal.
    if (!userId) {
      return true;
    }

    const role = user?.role as RoleType;

    // Controllers read `req.userId` to attribute writes. It is written here,
    // by the context owner, rather than by RolesGuard — which only ran for
    // routes carrying @Roles() and left it undefined everywhere else.
    request.userId = userId;

    // Identity is written before resolution is attempted so that a failed
    // resolution is still attributable in audit logs and error reporting.
    RequestContextService.applyExecutionScope(request.context, {
      userId,
      userEmail: user?.email ?? null,
      role: role ?? null,
      organizationId: null,
      branchId: null,
      academicYearId: null,
      branch: null,
      academicYear: null,
    });

    const input = {
      user: {
        id: userId,
        role,
        organizationId: user?.organizationId || null,
        branchId: user?.branchId || null,
      },
      headers: {
        organizationId: this.header(request, 'x-organization-id'),
        branchId: this.header(request, 'x-branch-id'),
        academicYearId: this.header(request, 'x-academic-year-id'),
      },
      requestId: request.requestId || request.context?.requestId,
    };

    // Until the workspace is bootstrapped the tenant hierarchy is incomplete by
    // definition, and the strict resolver would reject every request. Resolve
    // best-effort instead so the setup routes can operate on whatever already
    // exists — a branch created in the previous step, for example.
    const scope = (await this.setupService.isInitialized())
      ? (await this.contextResolver.resolveContext(input)).context
      : await this.contextResolver.resolveBootstrapContext(input);

    RequestContextService.applyExecutionScope(request.context, {
      userId,
      userEmail: user?.email ?? null,
      role: role ?? null,
      organizationId: scope.organizationId,
      branchId: scope.branchId,
      academicYearId: scope.academicYearId,
      branch: scope.branch ?? null,
      academicYear: scope.academicYear ?? null,
    });

    return true;
  }

  private resolveUserId(user: AuthenticatedUser | undefined): string | null {
    return user?.id || user?.sub || null;
  }

  private header(request: AuthenticatedRequest, name: string): string | null {
    const value = request.headers[name];
    return typeof value === 'string' ? value : null;
  }
}
