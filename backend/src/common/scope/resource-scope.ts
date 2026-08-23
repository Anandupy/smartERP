import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { RequestContext } from '@/common/logger/request-context.types';
import { UserRole } from '@/common/enums/role.enum';

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

/**
 * Asserts that a body-supplied organization id agrees with the scope
 * `ExecutionContextGuard` already resolved and validated onto the request.
 *
 * This is not a second authorization check: `ContextResolverService` already
 * refused a header naming an organization the caller cannot see. It closes a
 * different gap — a create DTO that carries its own `organizationId` field,
 * which a handler can accept from the body without ever consulting the
 * resolved context. Without this, an ORG_ADMIN's own tenant scope is
 * enforced for reads but not for the id it types into a request body.
 *
 * SUPER_ADMIN is the platform-level role and acts across every tenant, so it
 * is exempt. Every other role must match the organization already on the
 * context; a caller with no resolved organization can target none.
 *
 * A request that reached a controller always carries a context —
 * `ExecutionContextGuard` populates one for every authenticated route, even
 * when its fields are null. An absent `context` therefore means this was
 * called directly by internal code (the seeder, a script, another service)
 * outside the HTTP guard pipeline, which is trusted by construction and is
 * left unrestricted, exactly like `UserService.createUser`'s handling of an
 * absent actor role.
 *
 * This is single-organization-per-user scoping, matching the current
 * `User.organizationId` model end to end (see `ContextDiscoveryService`). If
 * a future identity model grants one ORG_ADMIN several organizations, this
 * function is the one place that needs to change to consult that mapping
 * instead of `context.organizationId` — callers do not change.
 */
export function assertOrganizationInScope(
  context: RequestContext | undefined,
  targetOrganizationId: string | null | undefined,
): void {
  if (!context || context.role === UserRole.SUPER_ADMIN) {
    return;
  }

  if (
    !targetOrganizationId ||
    !context?.organizationId ||
    context.organizationId !== targetOrganizationId
  ) {
    throw new ForbiddenException({
      error: 'ORGANIZATION_SCOPE_VIOLATION',
      message: 'This organization is outside your authorized scope.',
    });
  }
}

/**
 * Asserts that a body-supplied branch id agrees with the caller's authorized
 * scope, for the roles that are scoped to one branch.
 *
 * SUPER_ADMIN and ORG_ADMIN are exempt here deliberately: SUPER_ADMIN acts
 * across every tenant, and ORG_ADMIN is scoped to an *organization*, not to
 * one branch within it — pair this with `assertOrganizationInScope` against
 * the branch's own `organizationId` to confine an ORG_ADMIN to their tenant.
 * Every other role (BRANCH_ADMIN today) must match the branch already
 * resolved onto the context.
 *
 * An absent `context` means an internal caller outside the HTTP guard
 * pipeline — see `assertOrganizationInScope` — and is left unrestricted.
 */
export function assertBranchInScope(
  context: RequestContext | undefined,
  targetBranchId: string | null | undefined,
): void {
  if (
    !context ||
    context.role === UserRole.SUPER_ADMIN ||
    context.role === UserRole.ORG_ADMIN
  ) {
    return;
  }

  if (
    !targetBranchId ||
    !context?.branchId ||
    context.branchId !== targetBranchId
  ) {
    throw new ForbiddenException({
      error: 'BRANCH_SCOPE_VIOLATION',
      message: 'This branch is outside your authorized scope.',
    });
  }
}
