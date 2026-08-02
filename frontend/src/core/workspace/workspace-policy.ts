import type {
  WorkspaceAcademicYear,
  WorkspaceAvailability,
  WorkspaceBranch,
  WorkspaceOptions,
  WorkspaceResolution,
  WorkspaceSelection,
} from "./types";

/**
 * The whole workspace decision, as pure functions.
 *
 * Filtering, cascading and "does this user even get a choice?" live here and
 * nowhere else, so the selection screen, the future workspace switcher and the
 * post-login redirect cannot drift apart — they all call the same three
 * functions.
 */

/**
 * Roles that choose their own scope.
 *
 * Everyone else is scoped by the backend and is sent straight to the app; a
 * teacher does not pick which campus they teach at. Kept as data rather than
 * branching so adding a role is a one-line change.
 */
export const ROLES_REQUIRING_SELECTION = ["SUPER_ADMIN", "ORG_ADMIN"] as const;

export const EMPTY_SELECTION: WorkspaceSelection = {
  organizationId: null,
  branchId: null,
  academicYearId: null,
};

export function roleRequiresSelection(role: string | null): boolean {
  return (
    role !== null &&
    (ROLES_REQUIRING_SELECTION as readonly string[]).includes(role)
  );
}

/**
 * Branches belonging to an organization.
 *
 * A branch with no `organizationId` is in scope for every organization — see
 * the note on `WorkspaceBranch`. Passing `null` yields nothing, because "no
 * organization chosen" must not look like "every branch is available".
 */
export function branchesFor(
  branches: readonly WorkspaceBranch[],
  organizationId: string | null,
): WorkspaceBranch[] {
  if (organizationId === null) return [];
  return branches.filter(
    (branch) =>
      branch.organizationId === null ||
      branch.organizationId === organizationId,
  );
}

/**
 * Academic years valid for a scope.
 *
 * A year may be scoped to a branch, to an organization, or to neither; each
 * `null` link widens it rather than excluding it, for the same reason as
 * branches.
 */
export function academicYearsFor(
  academicYears: readonly WorkspaceAcademicYear[],
  scope: Pick<WorkspaceSelection, "organizationId" | "branchId">,
): WorkspaceAcademicYear[] {
  if (scope.organizationId === null) return [];
  return academicYears.filter((year) => {
    const organizationMatches =
      year.organizationId === null ||
      year.organizationId === scope.organizationId;
    const branchMatches =
      year.branchId === null || year.branchId === scope.branchId;
    return organizationMatches && branchMatches;
  });
}

/** The options valid for a given selection — the screen renders exactly these. */
export function optionsFor(
  availability: WorkspaceAvailability,
  selection: WorkspaceSelection,
): WorkspaceOptions {
  const branches = branchesFor(availability.branches, selection.organizationId);
  return {
    organizations: availability.organizations,
    branches,
    academicYears: academicYearsFor(availability.academicYears, selection),
  };
}

/** Is `id` one of the offered options? */
function isOffered(options: readonly { id: string }[], id: string | null) {
  return id !== null && options.some((option) => option.id === id);
}

/**
 * Keep an id if it is still offered, otherwise fall back: to the single option
 * when there is exactly one, and to `null` when there is a genuine choice.
 *
 * This is what makes the cascade work. Changing organization re-runs it for
 * branch and year, so a stale branch from the previous organization is dropped
 * instead of quietly surviving into a scope it does not belong to.
 */
function settle(options: readonly { id: string }[], id: string | null) {
  if (isOffered(options, id)) return id;
  return options.length === 1 ? options[0].id : null;
}

/**
 * Apply a partial change and re-settle everything downstream of it.
 *
 * Total and order-independent: callers pass whatever the user touched and get
 * back a selection that is internally consistent with `availability`.
 */
export function narrowSelection(
  availability: WorkspaceAvailability,
  current: WorkspaceSelection,
  next: Partial<WorkspaceSelection> = {},
): WorkspaceSelection {
  const merged = { ...current, ...next };

  const organizationId = settle(
    availability.organizations,
    merged.organizationId,
  );

  const branches = branchesFor(availability.branches, organizationId);
  // An explicitly changed organization invalidates a branch chosen under the
  // old one, even if that branch happens to be unscoped.
  const branchCandidate =
    next.organizationId !== undefined &&
    next.organizationId !== current.organizationId &&
    next.branchId === undefined
      ? null
      : merged.branchId;
  const branchId = settle(branches, branchCandidate);

  const academicYears = academicYearsFor(availability.academicYears, {
    organizationId,
    branchId,
  });
  const academicYearCandidate =
    branchId === merged.branchId ? merged.academicYearId : null;
  const academicYearId = settle(academicYears, academicYearCandidate);

  return { organizationId, branchId, academicYearId };
}

/** Does the user face a real choice, or only one possible answer? */
export function hasRealChoice(
  availability: WorkspaceAvailability,
  selection: WorkspaceSelection,
): boolean {
  const options = optionsFor(availability, selection);
  return (
    options.organizations.length > 1 ||
    options.branches.length > 1 ||
    options.academicYears.length > 1
  );
}

/**
 * Decide what happens after sign-in: go straight to the app, ask the user to
 * choose, or explain that there is nothing to enter.
 *
 * The rules, in order:
 *
 * 1. **Nothing to enter** — no organizations at all (and no default scope to
 *    fall back on) means the account exists but is mapped to no workspace.
 * 2. **Not the user's decision** — a role outside
 *    {@link ROLES_REQUIRING_SELECTION} is scoped by the backend, so its
 *    `defaults` are taken as-is and it never sees the screen.
 * 3. **Only one possible answer** — a privileged user with exactly one
 *    organization, branch and year is not offered a choice they cannot make.
 *    This is why single-tenant installs never see a selection step.
 * 4. **Otherwise** — a real choice exists, seeded from `seed` (the user's last
 *    selection) and then the backend defaults.
 *
 * Pure and total, so the entire policy is one testable function rather than
 * conditions spread across pages.
 */
export function resolveWorkspaceAccess(
  availability: WorkspaceAvailability,
  seed: WorkspaceSelection = EMPTY_SELECTION,
): WorkspaceResolution {
  // The user's own last choice outranks the backend default; the backend
  // default outranks nothing. Both are then clamped to what is actually on
  // offer, so a stale id cannot survive a permission change.
  const merged: WorkspaceSelection = {
    organizationId: seed.organizationId ?? availability.defaults.organizationId,
    branchId: seed.branchId ?? availability.defaults.branchId,
    academicYearId: seed.academicYearId ?? availability.defaults.academicYearId,
  };

  const hasAnyOrganization =
    availability.organizations.length > 0 ||
    availability.defaults.organizationId !== null;

  if (!hasAnyOrganization) {
    return {
      status: "unavailable",
      selection: EMPTY_SELECTION,
      reason: "no-organizations",
    };
  }

  if (!roleRequiresSelection(availability.role)) {
    // Backend-scoped roles are trusted as-is: their `context` is not a default
    // they may override, it is the only scope they have.
    return { status: "ready", selection: merged, reason: null };
  }

  const selection = narrowSelection(availability, merged);
  const options = optionsFor(availability, selection);

  if (options.organizations.length === 0) {
    return {
      status: "unavailable",
      selection,
      reason: "no-organizations",
    };
  }
  if (selection.organizationId !== null && options.branches.length === 0) {
    return { status: "unavailable", selection, reason: "no-branches" };
  }
  if (selection.branchId !== null && options.academicYears.length === 0) {
    return { status: "unavailable", selection, reason: "no-academic-years" };
  }

  const complete =
    selection.organizationId !== null &&
    selection.branchId !== null &&
    selection.academicYearId !== null;

  if (complete && !hasRealChoice(availability, selection)) {
    return { status: "ready", selection, reason: null };
  }

  return { status: "selecting", selection, reason: null };
}

/** Is every level of the scope filled in? */
export function isSelectionComplete(selection: WorkspaceSelection): boolean {
  return (
    selection.organizationId !== null &&
    selection.branchId !== null &&
    selection.academicYearId !== null
  );
}
