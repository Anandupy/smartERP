import { ROUTES } from "@/constants";
import type { GuideDefinition } from "@/core/guides";

/**
 * The Branches reference guide.
 *
 * Every step targets a real, already-shipped UI control — see
 * `docs/branch-module.md`. Branch status is a **toggle** with no target
 * state (`PATCH /branches/:id/status` flips whatever `isActive` currently
 * is, taking no body), so — unlike Academic Years' one-way Activate — this
 * guide never asks a first-time user to fire it: flipping a real campus's
 * operating status is exactly the kind of consequential, non-idempotent
 * action a walkthrough should explain rather than invite. The last step is
 * explanatory instead, pointing at the real Lifecycle timeline and ending
 * on the tooltip's own Next button.
 */
export const branchesGuide: GuideDefinition = {
  id: "branches",
  version: 1,
  title: "Branches",
  description:
    "Create the campus that operates inside an organization — every academic year, program and admission belongs to one.",
  entryRoutes: [ROUTES.app.branches.root],
  steps: [
    {
      id: "create-link",
      route: ROUTES.app.branches.root,
      target: '[data-guide="branch-dashboard-create-link"]',
      title: "Create your first branch",
      description:
        "A branch is the operational campus inside an organization — a school, college or center. Academic years, programs and admissions are all scoped to one. Start here.",
      placement: "bottom",
      advanceOn: "action",
    },
    {
      id: "create-submit",
      route: ROUTES.app.branches.create,
      target: '[data-guide="branch-create-submit"]',
      title: "Save the new branch",
      description:
        "The owning organization is filled in from your current workspace. Fill in the rest and create the branch to continue.",
      placement: "top",
      advanceOn: "action",
    },
    {
      id: "details-lifecycle-link",
      route: ROUTES.app.branches.detail(":id"),
      target: '[data-guide="branch-details-lifecycle-link"]',
      title: "Check its operating status",
      description:
        "This is the branch you just created. Lifecycle is where its operating status — active or inactive — and end-of-life policy are managed.",
      placement: "bottom",
      advanceOn: "action",
    },
    {
      id: "lifecycle-overview",
      route: ROUTES.app.branches.lifecycle(":id"),
      target: '[data-guide="branch-lifecycle-status-timeline"]',
      title: "Two of four stages are reachable",
      description:
        "Active and Inactive are backed by a real, reversible toggle, and a soft delete retires a branch without erasing it. Archiving and permanent deletion aren't supported by the backend yet, so they're marked rather than offered. Nothing here needs changing right now — the branch is ready to use.",
      placement: "bottom",
      advanceOn: "next-button",
    },
  ],
};
