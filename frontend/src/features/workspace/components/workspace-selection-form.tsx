"use client";

import { useState } from "react";

import { ArrowRight, Building2, CalendarDays } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/core/workspace";
import { InlineError } from "@/shared";

import {
  validateWorkspaceSelection,
  type WorkspaceSelectionValues,
} from "../schemas/workspace-selection.schema";
import { WorkspaceBranchField } from "./workspace-branch-field";
import { WorkspaceSelectField } from "./workspace-select-field";
import { WorkspaceSummary } from "./workspace-summary";

const FIELD_IDS = {
  organizationId: "workspace-organization",
  academicYearId: "workspace-academic-year",
} as const;

/**
 * Send focus to the level that still needs an answer.
 *
 * The campus step is a radio group, so its focus target is the first option
 * rather than a single control — matching where the browser would put focus if
 * the user tabbed into the group themselves.
 */
function focusField(field: keyof WorkspaceSelectionValues): void {
  const selector =
    field === "branchId"
      ? 'input[name="workspace-branch"]'
      : `#${FIELD_IDS[field]}`;
  document.querySelector<HTMLElement>(selector)?.focus();
}

export interface WorkspaceSelectionFormProps {
  /** Session-level escapes (sign out), supplied by the route. */
  sessionActions?: React.ReactNode;
}

/**
 * The three-step choice: organization → campus → academic year.
 *
 * All state lives in the workspace store, so this component holds none of it.
 * Cascading is not implemented here either — `select()` runs the platform's
 * `narrowSelection`, which is why changing organization clears a campus that
 * belonged to the old one without this form knowing the rule.
 *
 * Continue stays **enabled** while the selection is incomplete. A disabled
 * button states that something is wrong without saying what; pressing this one
 * names the missing level and moves focus to it.
 */
export function WorkspaceSelectionForm({
  sessionActions,
}: WorkspaceSelectionFormProps) {
  const {
    selection,
    options,
    organization,
    branch,
    academicYear,
    select,
    confirm,
  } = useWorkspace();
  const [attempted, setAttempted] = useState(false);

  const validation = validateWorkspaceSelection(selection, options);
  const showError = attempted && !validation.valid;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!validation.valid) {
      setAttempted(true);
      if (validation.field) focusField(validation.field);
      return;
    }

    confirm();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <WorkspaceSelectField
        id={FIELD_IDS.organizationId}
        label="Organization"
        icon={Building2}
        placeholder="Select an organization"
        emptyPlaceholder="No organizations available"
        value={selection.organizationId}
        options={options.organizations}
        onChange={(organizationId) => select({ organizationId })}
      />

      <WorkspaceBranchField
        label="Campus"
        emptyHint="Select an organization first to see its campuses."
        value={selection.branchId}
        options={options.branches}
        onChange={(branchId) => select({ branchId })}
      />

      <WorkspaceSelectField
        id={FIELD_IDS.academicYearId}
        label="Academic year"
        icon={CalendarDays}
        placeholder="Select an academic year"
        emptyPlaceholder="Select a campus first"
        value={selection.academicYearId}
        options={options.academicYears}
        onChange={(academicYearId) => select({ academicYearId })}
      />

      <WorkspaceSummary
        organization={organization}
        branch={branch}
        academicYear={academicYear}
      />

      {showError ? <InlineError description={validation.message} /> : null}

      <div className="space-y-3">
        <Button type="submit" size="lg" className="h-11 w-full">
          Continue
          <ArrowRight />
        </Button>
        {sessionActions ? (
          <div className="flex justify-center">{sessionActions}</div>
        ) : null}
      </div>
    </form>
  );
}
