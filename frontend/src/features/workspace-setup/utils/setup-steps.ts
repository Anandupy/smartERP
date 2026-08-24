import type { StepperStepStatus } from "@/components/ui/stepper";
import {
  SETUP_RESOURCES,
  type SetupResource,
  type WorkspaceSetupStatus,
} from "@/core/workspace";
import { ROUTES } from "@/constants";

import { canActOnStage } from "./setup-access";

export interface SetupStepDescriptor {
  key: SetupResource;
  resource: SetupResource;
  label: string;
  description: string;
  href: string;
  status: StepperStepStatus;
  /** False when the signed-in role has no authority to act on this stage. */
  actionable: boolean;
}

const STEP_COPY: Record<
  SetupResource,
  { label: string; description: string; href: string }
> = {
  SYSTEM_SETTINGS: {
    label: "System settings",
    description: "Product identity for this installation",
    href: ROUTES.setup.systemSettings,
  },
  ORGANIZATION: {
    label: "Organization",
    description: "Your institution's record",
    href: ROUTES.setup.organization,
  },
  BRANCH: {
    label: "Branch",
    description: "Your first campus",
    href: ROUTES.setup.branch,
  },
  ACADEMIC_YEAR: {
    label: "Academic year",
    description: "Your current session",
    href: ROUTES.setup.academicYear,
  },
};

/**
 * The mandatory foundation, in order, each carrying its display status and
 * whether the signed-in role may act on it.
 *
 * Pure: derives everything from the backend's own `missingResources` /
 * `completedResources` (never a frontend guess), plus the role→stage map in
 * `setup-access.ts`. This is the one place that map is applied, so the
 * welcome screen, the progress indicator and each step page cannot disagree
 * about where the wizard is.
 */
export function buildSetupSteps(
  setup: WorkspaceSetupStatus,
  role: string | null,
): SetupStepDescriptor[] {
  const firstMissing = setup.missingResources[0];

  return SETUP_RESOURCES.map((resource) => {
    const complete = setup.completedResources.includes(resource);
    const status: StepperStepStatus = complete
      ? "complete"
      : resource === firstMissing
        ? "current"
        : "upcoming";

    return {
      key: resource,
      resource,
      status,
      actionable: canActOnStage(resource, role),
      ...STEP_COPY[resource],
    };
  });
}

/** The one step, if any, this role should act on right now. */
export function currentSetupStep(
  setup: WorkspaceSetupStatus,
  role: string | null,
): SetupStepDescriptor | null {
  return (
    buildSetupSteps(setup, role).find((step) => step.status === "current") ??
    null
  );
}

/**
 * Where "Continue Setup" should go.
 *
 * `null` means there is nothing this role can do right now — every mandatory
 * resource exists (go to Review) or the next missing one belongs to a role
 * that is not this one (nothing to link to; the caller shows a waiting state
 * instead, per `docs/workspace-setup-module.md`).
 */
export function nextSetupHref(
  setup: WorkspaceSetupStatus,
  role: string | null,
): string | null {
  const current = currentSetupStep(setup, role);
  if (current) return current.actionable ? current.href : null;
  return ROUTES.setup.review;
}
