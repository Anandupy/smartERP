import { ROUTES } from "@/constants";
import type { GuideDefinition } from "@/core/guides";

/**
 * The Numbering reference guide.
 *
 * Numbering has no detail route (see `features/numbering/index.ts` — no
 * `GET /:id` is documented, an unwanted sequence is deactivated rather than
 * deleted), so this guide is deliberately two steps: create a sequence, then
 * it's done. The create-submit step targets the whole `<form>`, not the
 * submit button — Purpose, the format fields and the placeholder-chip
 * buttons all need to stay interactive while this step is shown, and
 * Joyride's dimmed overlay would otherwise block them (see docs/guides.md
 * "Guide target reliability").
 *
 * The guide never claims existing identifiers change — `numbering-config-
 * form.tsx`'s own copy is careful about this, and this guide's description
 * matches it: only records created *after* the save pick up the new format.
 */
export const numberingGuide: GuideDefinition = {
  id: "numbering",
  version: 1,
  title: "Numbering",
  description:
    "Configure the format CampusFlow uses to generate a human-facing identifier — a student code, an admission number, and others.",
  entryRoutes: [ROUTES.app.settings.numbering.root],
  steps: [
    {
      id: "list-create-link",
      route: ROUTES.app.settings.numbering.root,
      target: '[data-guide="numbering-list-create-link"]',
      title: "Create a sequence",
      description:
        "Each sequence configures how one kind of identifier is built — its prefix, suffix, and how the running number is padded. Start here.",
      placement: "bottom",
      advanceOn: "action",
    },
    {
      id: "create-submit",
      route: ROUTES.app.settings.numbering.create,
      target: '[data-guide="numbering-create-submit"]',
      title: "Save the sequence",
      description:
        "Choose what this sequence numbers, then build its format from the placeholders below — it must include {sequence}. Only records created after you save pick up this format; anything already issued keeps its original identifier.",
      advanceOn: "action",
    },
  ],
};
