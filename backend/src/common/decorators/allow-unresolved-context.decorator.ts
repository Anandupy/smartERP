import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNRESOLVED_CONTEXT_KEY = 'allowUnresolvedContext';

/**
 * Marks a route that operates **above or before** a single tenant scope.
 *
 * Context resolution normally answers an ambiguous scope — a user who can see
 * more than one organization, and no `x-organization-id` header to say which —
 * with `409 CONTEXT_SELECTION_REQUIRED`, so the client selects one and retries.
 * That is right for a route that reads or writes inside one tenant, and wrong
 * for the two kinds of route that cannot possibly satisfy it:
 *
 * - **The route that reports the choices.** `GET /auth/me` returns
 *   `availableOrganizations`. Demanding a selection before it answers makes the
 *   selection impossible to make: the client cannot choose from a list it is
 *   not allowed to fetch.
 * - **The route that administers tenants.** The Organization endpoints are
 *   `SUPER_ADMIN`/`ORG_ADMIN` surfaces that name their target in the path and
 *   never read the request scope. "Which organization am I in?" has no bearing
 *   on them.
 *
 * This is **not** a security bypass and not an authorization decorator.
 * Authentication, `@Roles()`, `@RequirePermission()` and every tenant boundary
 * check in `ContextValidatorService` still apply — a supplied header is still
 * validated, and a cross-tenant one is still refused. The only thing it changes
 * is what happens when the scope is *ambiguous*: the ambiguous level and the
 * levels below it are left `null` instead of failing the request.
 *
 * Marking a route that reads `req.context` for scoping would therefore be a
 * mistake: it would run with a null scope rather than a chosen one. Routes that
 * need a scope declare `@RequireBranch()` / `@RequireAcademicYear()` instead.
 */
export const AllowUnresolvedContext = () =>
  SetMetadata(ALLOW_UNRESOLVED_CONTEXT_KEY, true);
