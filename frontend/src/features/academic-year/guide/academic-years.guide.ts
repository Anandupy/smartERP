import { ROUTES } from "@/constants";
import type { GuideDefinition } from "@/core/guides";

/**
 * The Academic Years reference guide.
 *
 * Every step targets a real, already-shipped UI control — see
 * `docs/academic-year-module.md` and the module's own `index.ts` for the five
 * contract facts this module is built around. In particular: creating a year
 * redirects to its **Details** screen, not Lifecycle, so "now activate it" is
 * a separate, cross-route step rather than living on the create screen — and
 * `activate` is the only lifecycle transition this guide references. Select
 * and Lock are real, but outside a first-time walkthrough's scope; Deactivate,
 * Deselect, Unlock, Archive, Restore and Permanent-delete do not exist in the
 * contract at all and must never appear here.
 *
 * None of the four steps shows a "Next" button — each is `advanceOn:
 * "action"`, because in every case the real UI control is the next thing to
 * click (per `docs/guides.md` §"Interactive vs explanatory steps"). Steps 1
 * and 3 advance automatically once the user follows the real link to the
 * next step's route; steps 2 and 4 advance because
 * `create-academic-year-screen.tsx` and `academic-year-lifecycle-screen.tsx`
 * call `useGuide("academic-years").reportEvent()` /
 * `.completeGuide()` after the real mutation succeeds.
 */
export const academicYearsGuide: GuideDefinition = {
  id: "academic-years",
  version: 1,
  title: "Academic Years",
  description:
    "Create an academic year for this branch, then activate it so it becomes available for data entry.",
  entryRoutes: [ROUTES.app.academicYears.root],
  steps: [
    {
      id: "create-link",
      route: ROUTES.app.academicYears.root,
      target: '[data-guide="academic-year-dashboard-create-link"]',
      title: "Create your first academic year",
      description:
        "Academic years are the administrative timeframes this branch operates in. Start here.",
      placement: "bottom",
      advanceOn: "action",
    },
    {
      id: "create-submit",
      route: ROUTES.app.academicYears.create,
      target: '[data-guide="academic-year-create-submit"]',
      title: "Save the new year",
      description:
        "Fill in the name and date range, then create the year to continue.",
      placement: "top",
      advanceOn: "action",
    },
    {
      id: "details-next-action",
      route: ROUTES.app.academicYears.detail(":id"),
      target: '[data-guide="academic-year-details-lifecycle-link"]',
      title: "Now activate it",
      description:
        "A new year isn't available for data entry until it's activated. Open Lifecycle to do that.",
      placement: "bottom",
      advanceOn: "action",
    },
    {
      id: "activate",
      route: ROUTES.app.academicYears.lifecycle(":id"),
      target: '[data-guide="academic-year-activate"]',
      title: "Activate the year",
      description:
        "This marks the year valid for data entry. There's no documented way to deactivate it afterwards, so double-check the year before confirming.",
      placement: "bottom",
      advanceOn: "action",
    },
  ],
};
