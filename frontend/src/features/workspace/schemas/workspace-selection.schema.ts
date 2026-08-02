import { z } from "zod";

import type { WorkspaceOptions, WorkspaceSelection } from "@/core/workspace";

/**
 * A complete workspace selection.
 *
 * Shape validation only — that all three levels were answered. Whether those
 * ids are *allowed* is a question about the offered options, which the schema
 * cannot see; `validateWorkspaceSelection` answers that.
 */
export const workspaceSelectionSchema = z.object({
  organizationId: z.string().min(1, "Select an organization to continue."),
  branchId: z.string().min(1, "Select a campus to continue."),
  academicYearId: z.string().min(1, "Select an academic year to continue."),
});

export type WorkspaceSelectionValues = z.infer<typeof workspaceSelectionSchema>;

export interface WorkspaceSelectionValidation {
  valid: boolean;
  /** The first unmet requirement, phrased as the next action to take. */
  message: string | null;
  /** Which level to send focus to when the user tries to continue anyway. */
  field: keyof WorkspaceSelectionValues | null;
}

const LEVELS = [
  {
    field: "organizationId",
    options: "organizations",
    message: "Select an organization to continue.",
  },
  {
    field: "branchId",
    options: "branches",
    message: "Select a campus to continue.",
  },
  {
    field: "academicYearId",
    options: "academicYears",
    message: "Select an academic year to continue.",
  },
] as const;

/**
 * Validate a selection against the options actually on offer.
 *
 * Checked in order, reporting only the first gap: the levels cascade, so
 * telling someone their academic year is missing while they have not chosen an
 * organization describes a problem they cannot yet act on.
 *
 * Membership is re-checked rather than trusted because a selection can be
 * restored from storage, where it may name a scope that has since been
 * withdrawn.
 */
export function validateWorkspaceSelection(
  selection: WorkspaceSelection,
  options: WorkspaceOptions,
): WorkspaceSelectionValidation {
  for (const level of LEVELS) {
    const id = selection[level.field];
    const offered = options[level.options];

    if (id === null || !offered.some((option) => option.id === id)) {
      return { valid: false, message: level.message, field: level.field };
    }
  }

  return { valid: true, message: null, field: null };
}
