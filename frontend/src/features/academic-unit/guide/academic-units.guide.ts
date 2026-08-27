import { ROUTES } from "@/constants";
import type { GuideDefinition } from "@/core/guides";

/**
 * The Academic Units reference guide.
 *
 * Every step targets a real, already-shipped UI control — see
 * `docs/academic-unit-module.md`. Deliberately never says "class" or
 * "division" as if that were the universal shape: the documented model is
 * explicit that `unitType` is a display tag only ("Avoid Hardcoding Enums
 * … always depend on tree structure and node references rather than
 * hardcoding logic targeting a specific level like 'CLASS'") — a school's
 * Section → Class → Division and a college's Sector → Stream → Year are
 * both just unlabelled parent/child nesting to the backend. This guide's
 * copy follows that: "unit" throughout, the real `unitType` select left to
 * name the level itself.
 *
 * Unlike Organizations/Branches/Programs, this module needs **two** halves
 * of workspace scope (branch and academic year) before it's usable at all —
 * `AcademicUnitScopeGate` already resolves and explains that missing-scope
 * state on its own, so this guide never tries to; it assumes scope is
 * already ready, the same assumption every other reference guide makes.
 *
 * The last step is explanatory (Type B), not an action, for the same reason
 * as Programs' and Branches': re-parenting a unit is a real, consequential
 * operation ("a move rewrites every descendant's level") that a first-time
 * tour should explain rather than perform on the user's behalf.
 */
export const academicUnitsGuide: GuideDefinition = {
  id: "academic-units",
  version: 1,
  title: "Academic Units",
  description:
    "Build the operational structure inside a program — the classes, divisions and batches scoped to one academic year at a time.",
  entryRoutes: [ROUTES.app.academicUnits.root],
  steps: [
    {
      id: "create-link",
      route: ROUTES.app.academicUnits.root,
      target: '[data-guide="academic-unit-dashboard-create-link"]',
      title: "Create your first academic unit",
      description:
        "An academic unit is the building block of your institution's structure — a department, class, division or batch, nested however deep you need. It always sits inside a program, and it belongs to one academic year. Start here.",
      placement: "bottom",
      advanceOn: "action",
    },
    {
      id: "create-submit",
      // Targets the whole `<form>`, not just the submit button — the same
      // reason as Programs' create-submit step: the required Program
      // picker lives elsewhere in the form, and Joyride's dimmed overlay
      // would otherwise block clicking it. See docs/guides.md "Guide
      // target reliability."
      route: ROUTES.app.academicUnits.create,
      target: '[data-guide="academic-unit-create-submit"]',
      title: "Save the new unit",
      description:
        "Pick the program it belongs to, and — if it should nest under something — a parent unit already in that program. Name it and choose a type that fits your institution, then create it.",
      advanceOn: "action",
    },
    {
      id: "details-move-explainer",
      route: ROUTES.app.academicUnits.detail(":id"),
      target: '[data-guide="academic-unit-details-move-button"]',
      title: "That's the structure started",
      description:
        "Repeat this for every level your institution needs. If a unit ever needs to sit somewhere else in the hierarchy, Move handles it — it re-parents the unit and updates every level beneath it in one safe step.",
      placement: "bottom",
      advanceOn: "next-button",
    },
  ],
};
