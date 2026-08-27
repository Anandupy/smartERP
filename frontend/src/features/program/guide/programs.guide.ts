import { ROUTES } from "@/constants";
import type { GuideDefinition } from "@/core/guides";

/**
 * The Programs reference guide.
 *
 * Every step targets a real, already-shipped UI control — see
 * `docs/program-module.md`. A program is the academic vertical inside a
 * branch ("Primary (English)", "B.Tech (Engineering)"); the dashboard's own
 * empty-state banner states the real dependency this guide's last step
 * leans on: "Academic units name a program in their request body, so the
 * operational structure … cannot be built until at least one program
 * exists." That is why Programs is the step *before* Academic Units in the
 * real setup journey, not after — despite the reverse order a first read of
 * the terms might suggest.
 *
 * Like Organizations, this guide's last step is explanatory (Type B), not
 * an action: the status toggle is a non-idempotent flip
 * (`PATCH /programs/:id/status` takes no body), so simulating it to give
 * the tour one more "click here" would be exactly the kind of
 * consequence-hiding automation `docs/guides.md` §7 rules out. Instead the
 * last step points at the real, already-shipped bridge to what comes
 * next — the program details screen's "View the unit hierarchy" link.
 */
export const programsGuide: GuideDefinition = {
  id: "programs",
  version: 1,
  title: "Programs",
  description:
    "Define the academic verticals inside this branch — the classification that Academic Units are built inside.",
  entryRoutes: [ROUTES.app.programs.root],
  steps: [
    {
      id: "create-link",
      route: ROUTES.app.programs.root,
      target: '[data-guide="program-dashboard-create-link"]',
      title: "Create your first program",
      description:
        "A program is an academic vertical inside this branch — things like \"Primary (English)\" or \"B.Tech (Engineering)\". Academic Units — the classes, divisions and batches inside it — can't be created until at least one program exists. Start here.",
      placement: "bottom",
      advanceOn: "action",
    },
    {
      id: "create-submit",
      // Targets the whole `<form>`, not just the submit button: Joyride's
      // dimmed overlay blocks pointer events everywhere outside its
      // spotlight cutout, so a target narrower than every field the user
      // still needs to interact with (a parent-program picker here) would
      // trap them — confirmed live, not assumed. See docs/guides.md
      // "Guide target reliability."
      route: ROUTES.app.programs.create,
      target: '[data-guide="program-create-submit"]',
      title: "Save the new program",
      description:
        "Name it, and optionally set its medium, stream and a parent program if it's part of a group. Create it to continue.",
      advanceOn: "action",
    },
    {
      id: "details-unit-hierarchy-link",
      route: ROUTES.app.programs.detail(":id"),
      target: '[data-guide="program-details-unit-hierarchy-link"]',
      title: "Now build the structure inside it",
      description:
        "This program is active immediately — there's nothing to activate. The next step is Academic Units: the classes, divisions and batches that operate inside a program, scoped to one academic year at a time. This is where that starts.",
      placement: "bottom",
      advanceOn: "next-button",
    },
  ],
};
