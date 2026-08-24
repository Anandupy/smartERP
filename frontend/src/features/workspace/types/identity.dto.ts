/**
 * Wire contracts for `GET /auth/me`.
 *
 * This is the single endpoint the workspace feature reads. Its payload carries
 * three things at once: who the user is, what they may do, and which scopes
 * they may operate in.
 *
 * ## Why almost everything is optional
 *
 * Only `user.id` and each entity's `id` are treated as guaranteed. Every other
 * field is optional here and defaulted in the mapper, because a scope list is
 * shaped by the caller's role: a branch administrator's payload legitimately
 * omits the organization list a super administrator gets. Typing those as
 * required would turn a normal response into a runtime crash.
 *
 * Nothing beyond these fields is read. Form-facing types live in `schemas/`,
 * and `mappers/identity.mapper.ts` is the only translation between them.
 */

/** The signed-in user, as `/auth/me` describes them. */
export interface IdentityUserDto {
  id: string;
  fullName?: string | null;
  /**
   * Present only if the backend includes it. When absent the mapper falls back
   * to the access token's `email` claim rather than inventing a display value.
   */
  email?: string | null;
  role?: string | null;
}

/** The scope the backend currently considers active for this user. */
export interface IdentityContextDto {
  organizationId?: string | null;
  branchId?: string | null;
  academicYearId?: string | null;
}

/** Common shape of every selectable scope entity. */
export interface IdentityScopeDto {
  id: string;
  name?: string | null;
  code?: string | null;
}

export interface IdentityBranchDto extends IdentityScopeDto {
  /** Link to the owning organization, when the backend scopes the list. */
  organizationId?: string | null;
}

export interface IdentityAcademicYearDto extends IdentityScopeDto {
  organizationId?: string | null;
  branchId?: string | null;
}

/** One call the client may make while setup is incomplete. */
export interface IdentitySetupActionDto {
  action?: string | null;
  method?: string | null;
  path?: string | null;
  description?: string | null;
}

/**
 * The workspace bootstrap block `/auth/me` carries alongside identity.
 *
 * Everything is optional here for the same reason the rest of this file is:
 * an older backend, or a response `/auth/me` genuinely omits it from, must not
 * crash the mapper. `toWorkspaceSetupStatus` treats a missing or unrecognized
 * `setupRequired` as "no setup information available" rather than guessing —
 * see its doc comment.
 */
export interface IdentitySetupDto {
  setupRequired?: boolean | null;
  setupStage?: string | null;
  missingResources?: string[] | null;
  completedResources?: string[] | null;
  allowedActions?: IdentitySetupActionDto[] | null;
  initializedAt?: string | null;
}

/** `GET /auth/me` → the unwrapped `data` payload. */
export interface IdentityDto {
  user: IdentityUserDto;
  /**
   * Effective permissions. Typed as `unknown` because the element shape is not
   * pinned by the contract: the mapper accepts plain strings and objects
   * carrying a string `code`/`name`/`permission`, and drops anything else. An
   * unreadable list yields no permissions, so checks fail closed.
   */
  permissions?: unknown;
  context?: IdentityContextDto | null;
  availableOrganizations?: IdentityScopeDto[] | null;
  availableBranches?: IdentityBranchDto[] | null;
  availableAcademicYears?: IdentityAcademicYearDto[] | null;
  /** Absent on a backend that predates the setup lifecycle. */
  setup?: IdentitySetupDto | null;
}
