import type { ID } from "@/types/common";

/**
 * Workspace domain contracts.
 *
 * A "workspace" is the scope every ERP screen operates inside: one
 * organization, one branch of it, and one academic year. These types describe
 * the **normalized** shape the app codes against — the wire shapes stay in
 * `features/workspace/types`, and the mapper there is the only translation.
 *
 * Nothing here knows how the scope is fetched, which is what lets the workspace
 * switcher, the header, and the selection screen all read the same context.
 */

/** Common shape of everything a user can select. */
export interface WorkspaceEntity {
  id: ID;
  name: string;
  /**
   * Short human-facing identifier shown beneath the name. `null` whenever the
   * backend does not supply one — never fabricated from the id.
   */
  code: string | null;
}

export type WorkspaceOrganization = WorkspaceEntity;

export interface WorkspaceBranch extends WorkspaceEntity {
  /**
   * Owning organization.
   *
   * `null` when the backend already scoped the list server-side and omitted the
   * link. Filtering treats a `null` link as "in scope everywhere", so an
   * unexpectedly flat payload still renders every branch instead of silently
   * producing an empty list.
   */
  organizationId: ID | null;
}

export interface WorkspaceAcademicYear extends WorkspaceEntity {
  /** See `WorkspaceBranch.organizationId` — same `null` semantics. */
  organizationId: ID | null;
  /** Set when a year belongs to one branch rather than the whole organization. */
  branchId: ID | null;
}

/** The three ids that constitute a scope. This is all that is ever persisted. */
export interface WorkspaceSelection {
  organizationId: ID | null;
  branchId: ID | null;
  academicYearId: ID | null;
}

/**
 * Everything the resolver needs, pushed in by the workspace feature once
 * identity has loaded. Core never fetches it.
 */
export interface WorkspaceAvailability {
  organizations: WorkspaceOrganization[];
  branches: WorkspaceBranch[];
  academicYears: WorkspaceAcademicYear[];
  /**
   * The scope the backend considers current. Treated as a *default*, not a
   * command: a selection the user made earlier outranks it when still valid.
   */
  defaults: WorkspaceSelection;
  /** Drives whether a choice is offered at all. `null` when unknown. */
  role: string | null;
}

/**
 * Where the workspace platform currently stands.
 *
 * - `idle` — nothing loaded yet; the app cannot decide anything.
 * - `selecting` — a real choice exists and the user has not resolved it.
 * - `ready` — a complete scope is active; scoped screens may render.
 * - `unavailable` — authenticated, but no scope can be formed at all.
 */
export type WorkspaceStatus = "idle" | "selecting" | "ready" | "unavailable";

/** Which level came up empty, so the UI can say precisely what is missing. */
export type WorkspaceUnavailableReason =
  "no-organizations" | "no-branches" | "no-academic-years";

/** Outcome of running the resolution policy over availability. */
export interface WorkspaceResolution {
  status: WorkspaceStatus;
  selection: WorkspaceSelection;
  reason: WorkspaceUnavailableReason | null;
}

/** The options valid for the current selection, already filtered. */
export interface WorkspaceOptions {
  organizations: WorkspaceOrganization[];
  branches: WorkspaceBranch[];
  academicYears: WorkspaceAcademicYear[];
}

/** What `useWorkspace()` hands to every consumer. */
export interface WorkspaceContextValue {
  status: WorkspaceStatus;
  reason: WorkspaceUnavailableReason | null;
  /** Resolved entities for the active selection, or `null` while incomplete. */
  organization: WorkspaceOrganization | null;
  branch: WorkspaceBranch | null;
  academicYear: WorkspaceAcademicYear | null;
  selection: WorkspaceSelection;
  options: WorkspaceOptions;
  /** True once a complete scope is active. */
  isReady: boolean;
  /** True while the user still has a choice to make. */
  requiresSelection: boolean;
  /** Apply a partial change; downstream levels cascade automatically. */
  select: (next: Partial<WorkspaceSelection>) => void;
  /** Accept the current selection and move to `ready`. */
  confirm: () => void;
  /** Drop the scope entirely (sign-out, switch user). */
  clear: () => void;
}
