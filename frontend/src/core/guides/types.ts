import type { Placement } from "react-joyride";

import type { PermissionContextValue } from "@/core/auth";
import type { WorkspaceContextValue } from "@/core/workspace";

/**
 * Guide content model.
 *
 * A `GuideDefinition` is static, versioned data — it never carries React state
 * or DOM references. `core/guides` renders and persists it; feature modules own
 * authoring it (see `docs/guides.md`).
 */

/** Live context a guide/step's `requirement` is evaluated against. Never a
 * hardcoded role name — CampusFlow has no fixed role enum, only flat
 * permission strings and `hasRole(string)` (see `core/auth`). */
export interface GuideEvalContext {
  permissions: PermissionContextValue;
  workspace: WorkspaceContextValue;
}

export type GuideCondition = (context: GuideEvalContext) => boolean;

/**
 * How a step hands control back to the guide:
 * - `"next-button"` — the tooltip's own Next button advances it.
 * - `"action"` — the real UI action is the advance. The step's own screen
 *   calls `useGuide(id).reportEvent()` (or `completeGuide()` on the last step)
 *   after the real mutation succeeds; the tooltip shows no Next button.
 */
export type GuideStepAdvanceMode = "next-button" | "action";

export interface GuideStep {
  /** Stable within the guide; used for logging and dev diagnostics. */
  id: string;
  /**
   * The route this step belongs to. Supports one dynamic segment per path
   * component, written `:name` (e.g. `/app/academic-years/:id`) — see
   * `route-match.ts`.
   */
  route: string;
  /** A `[data-guide="..."]` selector. Never a fragile structural selector. */
  target: string;
  title: string;
  description: string;
  placement?: Placement;
  advanceOn: GuideStepAdvanceMode;
  /** Skips the step (and the guide, if every remaining step is skipped)
   * when this returns false — e.g. a permission the current user lacks. */
  requirement?: GuideCondition;
}

export interface GuideDefinition {
  id: string;
  /** Bump when the steps/copy change meaningfully. A user who completed an
   * older version becomes eligible for the guide again (`hasSeen` compares
   * versions), but is never forced through an unchanged tour repeatedly. */
  version: number;
  title: string;
  description: string;
  /** Routes where "Start guided tour" may be offered (the Help drawer). */
  entryRoutes: readonly string[];
  steps: readonly GuideStep[];
  /** Gates the whole guide (e.g. Help drawer visibility), independent of any
   * per-step requirement. */
  requirement?: GuideCondition;
}

export type GuideRunStatus = "idle" | "running" | "completed" | "skipped";

export interface GuideCompletionRecord {
  version: number;
  completedAt: string;
}
