import { describe, expect, it } from "vitest";

import type { WorkspaceSetupStatus } from "@/core/workspace";
import {
  canActOnStage,
  canCompleteSetup,
  roleCanAccessSetupWizard,
} from "@/features/workspace-setup/utils/setup-access";
import {
  buildSetupSteps,
  currentSetupStep,
  nextSetupHref,
} from "@/features/workspace-setup/utils/setup-steps";

/**
 * The wizard's role→stage rules and derived step list — the logic every
 * screen (welcome, progress indicator, each step page) reads instead of
 * repeating its own copy of "who can do what."
 */

function setup(overrides: Partial<WorkspaceSetupStatus> = {}): WorkspaceSetupStatus {
  return {
    setupRequired: true,
    setupStage: "SYSTEM_SETTINGS",
    missingResources: ["SYSTEM_SETTINGS", "ORGANIZATION", "BRANCH", "ACADEMIC_YEAR"],
    completedResources: [],
    allowedActions: [],
    initializedAt: null,
    ...overrides,
  };
}

describe("canActOnStage", () => {
  it("restricts system settings and organization to SUPER_ADMIN", () => {
    expect(canActOnStage("SYSTEM_SETTINGS", "SUPER_ADMIN")).toBe(true);
    expect(canActOnStage("SYSTEM_SETTINGS", "ORG_ADMIN")).toBe(false);
    expect(canActOnStage("ORGANIZATION", "ORG_ADMIN")).toBe(false);
  });

  it("allows ORG_ADMIN on branch and academic year", () => {
    expect(canActOnStage("BRANCH", "ORG_ADMIN")).toBe(true);
    expect(canActOnStage("ACADEMIC_YEAR", "ORG_ADMIN")).toBe(true);
  });

  it("denies everything to a role with no setup authority", () => {
    expect(canActOnStage("BRANCH", "STAFF")).toBe(false);
    expect(canActOnStage("BRANCH", null)).toBe(false);
  });
});

describe("canCompleteSetup", () => {
  it("is SUPER_ADMIN-only, even for the ORG_ADMIN who did the work", () => {
    expect(canCompleteSetup("SUPER_ADMIN")).toBe(true);
    expect(canCompleteSetup("ORG_ADMIN")).toBe(false);
    expect(canCompleteSetup(null)).toBe(false);
  });
});

describe("roleCanAccessSetupWizard", () => {
  it("matches the two roles the workspace-selection screen lets choose", () => {
    expect(roleCanAccessSetupWizard("SUPER_ADMIN")).toBe(true);
    expect(roleCanAccessSetupWizard("ORG_ADMIN")).toBe(true);
    expect(roleCanAccessSetupWizard("BRANCH_ADMIN")).toBe(false);
    expect(roleCanAccessSetupWizard("STAFF")).toBe(false);
    expect(roleCanAccessSetupWizard(null)).toBe(false);
  });
});

describe("buildSetupSteps", () => {
  it("marks every resource upcoming on a fresh install", () => {
    const steps = buildSetupSteps(setup(), "SUPER_ADMIN");
    expect(steps.map((step) => step.status)).toEqual([
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("marks completed resources done and the next missing one current", () => {
    const steps = buildSetupSteps(
      setup({
        missingResources: ["BRANCH", "ACADEMIC_YEAR"],
        completedResources: ["SYSTEM_SETTINGS", "ORGANIZATION"],
      }),
      "SUPER_ADMIN",
    );
    expect(steps.map((step) => step.status)).toEqual([
      "complete",
      "complete",
      "current",
      "upcoming",
    ]);
  });

  it("flags actionability per role independently of status", () => {
    const steps = buildSetupSteps(setup(), "ORG_ADMIN");
    const byResource = Object.fromEntries(
      steps.map((step) => [step.resource, step.actionable]),
    );
    expect(byResource.SYSTEM_SETTINGS).toBe(false);
    expect(byResource.ORGANIZATION).toBe(false);
    expect(byResource.BRANCH).toBe(true);
    expect(byResource.ACADEMIC_YEAR).toBe(true);
  });
});

describe("currentSetupStep / nextSetupHref", () => {
  it("returns the review route once nothing is missing", () => {
    const complete = setup({ missingResources: [], completedResources: [
      "SYSTEM_SETTINGS", "ORGANIZATION", "BRANCH", "ACADEMIC_YEAR",
    ] });
    expect(currentSetupStep(complete, "SUPER_ADMIN")).toBeNull();
    expect(nextSetupHref(complete, "SUPER_ADMIN")).toBe("/setup/review");
  });

  it("links straight to the actionable step for SUPER_ADMIN", () => {
    expect(nextSetupHref(setup(), "SUPER_ADMIN")).toBe("/setup/system-settings");
  });

  it("returns null for ORG_ADMIN blocked on a SUPER_ADMIN-only step", () => {
    // Nothing an ORG_ADMIN can click through to yet — the welcome screen must
    // show a waiting state instead of a broken or misleading link.
    expect(nextSetupHref(setup(), "ORG_ADMIN")).toBeNull();
  });

  it("hands ORG_ADMIN straight to branch once the organization exists", () => {
    const orgDone = setup({
      missingResources: ["BRANCH", "ACADEMIC_YEAR"],
      completedResources: ["SYSTEM_SETTINGS", "ORGANIZATION"],
    });
    expect(nextSetupHref(orgDone, "ORG_ADMIN")).toBe("/setup/branch");
  });
});
