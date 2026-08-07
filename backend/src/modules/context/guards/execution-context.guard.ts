import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { ALLOW_UNRESOLVED_CONTEXT_KEY } from '@/common/decorators/allow-unresolved-context.decorator';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '@/common/logger/request-context.middleware';
import { RequestContextService } from '@/common/logger/request-context.service';
import { ContextResolverService } from '../services/context-resolver.service';
import { WorkspaceSetupService } from '@/modules/workspace/setup/workspace-setup.service';
import { RoleType } from '@/generated/client';

/**
 * The header names each scope level is read from, in precedence order.
 *
 * The first name of each is canonical and is what the documentation and the
 * Postman collection specify. The second is an accepted alias that the shipped
 * web client sends, and dropping the request on the floor because of a name is
 * the worst of both worlds: the client believed it had named a scope, the
 * server saw none, and the caller was told to select the scope it had already
 * selected. Reading both makes the platform tolerant of the name while the
 * clients converge on one.
 *
 * An alias is only a spelling. The value is resolved and validated identically
 * whichever name carried it.
 */
export const SCOPE_HEADERS = {
  organizationId: ['x-organization-id', 'x-tenant-id'],
  branchId: ['x-branch-id'],
  academicYearId: ['x-academic-year-id', 'x-academic-year'],
} as const;

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
        organizationId: this.header(request, SCOPE_HEADERS.organizationId),
        branchId: this.header(request, SCOPE_HEADERS.branchId),
        academicYearId: this.header(request, SCOPE_HEADERS.academicYearId),
      },
      requestId: request.requestId || request.context?.requestId,
    };

    // Whether an ambiguous scope must be settled before this route may run.
    // Almost every route operates inside one tenant and says yes; the identity
    // and tenant-administration routes that sit above or before a selection
    // declare @AllowUnresolvedContext() and say no. Deciding it here, from
    // route metadata, keeps the rule in one place instead of in each
    // controller.
    const selectionRequired = !this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNRESOLVED_CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Until the workspace is bootstrapped the tenant hierarchy is incomplete by
    // definition, and the strict resolver would reject every request. Resolve
    // best-effort instead so the setup routes can operate on whatever already
    // exists — a branch created in the previous step, for example.
    const scope = (await this.setupService.isInitialized())
      ? (
          await this.contextResolver.resolveContext(input, {
            selectionRequired,
          })
        ).context
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

  /** The first of `names` present on the request. Node lowercases all names. */
  private header(
    request: AuthenticatedRequest,
    names: readonly string[],
  ): string | null {
    for (const name of names) {
      const value = request.headers[name];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return null;
  }
}
