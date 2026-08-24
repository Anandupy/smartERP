import type { AuthUser } from "@/core/auth";
import {
  SETUP_RESOURCES,
  SETUP_STAGES,
  type SetupActionDescriptor,
  type SetupResource,
  type WorkspaceAcademicYear,
  type WorkspaceAvailability,
  type WorkspaceBranch,
  type WorkspaceOrganization,
  type WorkspaceSelection,
  type WorkspaceSetupStage,
  type WorkspaceSetupStatus,
} from "@/core/workspace";

import type {
  IdentityAcademicYearDto,
  IdentityBranchDto,
  IdentityDto,
  IdentityScopeDto,
  IdentitySetupActionDto,
  IdentitySetupDto,
} from "../types/identity.dto";

/**
 * Translation between the `/auth/me` payload and the normalized shapes the app
 * codes against.
 *
 * Every difference between wire and domain is resolved here and nowhere else,
 * so a contract change is a one-file edit and each rule is unit-testable in
 * isolation. The functions are total: any payload the transport accepted
 * produces a usable result, because a missing scope list is a normal response
 * for a narrowly-scoped role, not an error.
 */

/** Trim to a non-empty string, or `null`. Never returns `""`. */
function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * A display name for an entity that has none.
 *
 * Falling back to the id keeps the option selectable and visibly identifiable
 * rather than rendering an empty row the user cannot tell apart — and it is
 * obviously a fallback, so a missing name reads as a data problem instead of
 * being silently papered over.
 */
function nameOf(dto: IdentityScopeDto): string {
  return text(dto.name) ?? text(dto.code) ?? dto.id;
}

function toOrganization(dto: IdentityScopeDto): WorkspaceOrganization {
  return { id: dto.id, name: nameOf(dto), code: text(dto.code) };
}

function toBranch(dto: IdentityBranchDto): WorkspaceBranch {
  return {
    id: dto.id,
    name: nameOf(dto),
    code: text(dto.code),
    organizationId: text(dto.organizationId),
  };
}

function toAcademicYear(dto: IdentityAcademicYearDto): WorkspaceAcademicYear {
  return {
    id: dto.id,
    name: nameOf(dto),
    code: text(dto.code),
    organizationId: text(dto.organizationId),
    branchId: text(dto.branchId),
  };
}

/** Drop entries with no usable id — an unidentifiable option cannot be chosen. */
function scopeList<TDto extends IdentityScopeDto, TEntity>(
  list: TDto[] | null | undefined,
  map: (dto: TDto) => TEntity,
): TEntity[] {
  if (!Array.isArray(list)) return [];
  return list.filter((dto) => text(dto?.id) !== null).map(map);
}

/**
 * Effective permissions → flat strings.
 *
 * The contract does not pin the element shape, so both of the plausible ones
 * are accepted: a bare `"students:read"`, or an object carrying it under
 * `code`, `name` or `permission`. Anything else is dropped, which leaves
 * `can()` failing closed — hiding UI the user may be entitled to is the safe
 * direction, whereas guessing at an unknown shape is not.
 */
export function toPermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): string[] => {
    const direct = text(entry);
    if (direct) return [direct];

    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const named =
        text(record.code) ?? text(record.name) ?? text(record.permission);
      if (named) return [named];
    }

    return [];
  });
}

/** `context` → the backend's current default scope. */
export function toDefaultSelection(dto: IdentityDto): WorkspaceSelection {
  return {
    organizationId: text(dto.context?.organizationId),
    branchId: text(dto.context?.branchId),
    academicYearId: text(dto.context?.academicYearId),
  };
}

/**
 * `/auth/me` → everything `core/workspace` needs to resolve a scope.
 *
 * The three `available*` lists become normalized entities; `context` becomes
 * the *defaults*, not a command — a selection the user made earlier outranks it
 * when still valid. See `resolveWorkspaceAccess`.
 */
export function toWorkspaceAvailability(
  dto: IdentityDto,
): WorkspaceAvailability {
  return {
    organizations: scopeList(dto.availableOrganizations, toOrganization),
    branches: scopeList(dto.availableBranches, toBranch),
    academicYears: scopeList(dto.availableAcademicYears, toAcademicYear),
    defaults: toDefaultSelection(dto),
    role: text(dto.user?.role),
  };
}

/**
 * `/auth/me` → the platform's `AuthUser`.
 *
 * This is what closes the two gaps the token-only login left behind: `name`
 * becomes the real full name instead of the email, and `permissions` is finally
 * populated, so `can()` stops failing closed for every check.
 *
 * `email` is the one field `/auth/me` may not carry. `fallback` supplies the
 * user built from the access token's claims, so the address stays correct
 * rather than being invented or blanked.
 */
function isSetupResource(value: string): value is SetupResource {
  return (SETUP_RESOURCES as readonly string[]).includes(value);
}

function isSetupStage(value: string): value is WorkspaceSetupStage {
  return (SETUP_STAGES as readonly string[]).includes(value);
}

/** Drop anything not on the documented list, rather than guess at it. */
function toResourceList(value: string[] | null | undefined): SetupResource[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isSetupResource);
}

function toSetupAction(
  dto: IdentitySetupActionDto,
): SetupActionDescriptor | null {
  const action = text(dto?.action);
  const method = text(dto?.method);
  const path = text(dto?.path);
  if (!action || !method || !path) return null;
  return { action, method, path, description: text(dto?.description) ?? "" };
}

/**
 * `/auth/me` → the workspace bootstrap state, or `null` when there is none to
 * read.
 *
 * `setupRequired` is the one field this treats as load-bearing: without a
 * boolean there, the block is either absent (an older backend) or malformed,
 * and in both cases the honest answer is "no setup information available" —
 * falling through to ordinary workspace resolution — rather than assuming
 * setup is or is not required.
 */
export function toWorkspaceSetupStatus(
  dto: IdentityDto,
): WorkspaceSetupStatus | null {
  const setup: IdentitySetupDto | null | undefined = dto.setup;
  if (!setup || typeof setup.setupRequired !== "boolean") return null;

  const stage = text(setup.setupStage);
  const allowedActions = Array.isArray(setup.allowedActions)
    ? setup.allowedActions
        .map(toSetupAction)
        .filter((action): action is SetupActionDescriptor => action !== null)
    : [];

  return {
    setupRequired: setup.setupRequired,
    // The stage names the next resource to create; an unrecognized value
    // falls back to the first stage rather than a guess further along.
    setupStage: stage && isSetupStage(stage) ? stage : SETUP_STAGES[0],
    missingResources: toResourceList(setup.missingResources),
    completedResources: toResourceList(setup.completedResources),
    allowedActions,
    initializedAt: text(setup.initializedAt),
  };
}

export function toIdentityUser(
  dto: IdentityDto,
  fallback?: AuthUser | null,
): AuthUser {
  const role = text(dto.user?.role);
  const email = text(dto.user?.email) ?? fallback?.email ?? "";

  return {
    id: text(dto.user?.id) ?? fallback?.id ?? "",
    email,
    name: text(dto.user?.fullName) ?? fallback?.name ?? email,
    roles: role ? [role] : (fallback?.roles ?? []),
    permissions: toPermissions(dto.permissions),
  };
}
