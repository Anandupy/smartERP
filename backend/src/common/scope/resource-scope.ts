import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { RequestContext } from '@/common/logger/request-context.types';

/**
 * The execution scope a resource operation runs in, as a single typed value.
 *
 * This is **not** a second context mechanism. It is a narrow, validated read of
 * the canonical `RequestContext` that `ExecutionContextGuard` already resolved,
 * shaped so a service signature can state which dimensions it requires.
 *
 * It replaces the `req.context?.branchId || ''` idiom, which is worse than it
 * looks: an empty string is a *valid-looking* scope value that silently matches
 * nothing, so a misconfigured route fails as an empty result set rather than as
 * an error, and the caller cannot tell "no rows" from "no scope".
 */
export interface ResourceScope {
  organizationId: string;
  branchId: string;
  academicYearId: string | null;
}

/** A scope for operations that span branches within one organization. */
export interface OrganizationScope {
  organizationId: string;
}

export interface ResourceScopeOptions {
  /** Require an academic year. Routes that declare `@RequireAcademicYear()`. */
  requireAcademicYear?: boolean;
}

/**
 * Build a branch-level scope from the request context.
 *
 * Throws rather than defaulting. A route reaching this without a resolved
 * organization or branch is missing `@RequireBranch()`, which is a wiring
 * mistake and not something to paper over at runtime.
 */
export function resourceScopeOf(
  context: RequestContext | undefined,
  options: ResourceScopeOptions = {},
): ResourceScope {
  if (!context) {
    throw new InternalServerErrorException(
      'Execution context is unavailable. This route runs outside the guard pipeline.',
    );
  }

  const { organizationId, branchId, academicYearId } = context;

  if (!organizationId) {
    throw new ForbiddenException({
      error: 'ORGANIZATION_SCOPE_REQUIRED',
      message: 'This operation requires a resolved organization scope.',
    });
  }

  if (!branchId) {
    throw new ForbiddenException({
      error: 'BRANCH_SCOPE_REQUIRED',
      message: 'This operation requires a resolved branch scope.',
    });
  }

  if (options.requireAcademicYear && !academicYearId) {
    throw new ForbiddenException({
      error: 'ACADEMIC_YEAR_SCOPE_REQUIRED',
      message: 'This operation requires a resolved academic year scope.',
    });
  }

  return { organizationId, branchId, academicYearId: academicYearId ?? null };
}

/** Build an organization-level scope, for operations that span branches. */
export function organizationScopeOf(
  context: RequestContext | undefined,
): OrganizationScope {
  if (!context?.organizationId) {
    throw new ForbiddenException({
      error: 'ORGANIZATION_SCOPE_REQUIRED',
      message: 'This operation requires a resolved organization scope.',
    });
  }
  return { organizationId: context.organizationId };
}

/**
 * The `WHERE` fragment that confines a query to a scope.
 *
 * Every read and every write in a tenant-owned module spreads this. A lookup by
 * id alone is the shape of BOLA: it answers for a row the caller was never
 * entitled to see, and — worse on a write — lets a caller act on one branch's
 * row while the surrounding operation stamps another branch's ids onto it.
 *
 * A miss must surface as 404, never 403: a 403 confirms the row exists.
 */
export function scopedWhere(
  scope: ResourceScope,
  options: { includeAcademicYear?: boolean } = {},
): {
  organizationId: string;
  branchId: string;
  academicYearId?: string;
} {
  return {
    organizationId: scope.organizationId,
    branchId: scope.branchId,
    ...(options.includeAcademicYear && scope.academicYearId
      ? { academicYearId: scope.academicYearId }
      : {}),
  };
}
