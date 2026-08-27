import { ROUTES } from "@/constants";
import type { GuideDefinition } from "@/core/guides";

/**
 * The Organizations reference guide.
 *
 * Every step targets a real, already-shipped UI control — see
 * `docs/organization-module.md`. Unlike Academic Years, an organization has
 * no "activate" step to demonstrate: it is `ACTIVE` the moment it is
 * created, and the only documented lifecycle action from there is
 * `DELETE /organizations/:id` (a soft-deactivate) — not something a
 * first-time walkthrough should invite a new admin to click. So the guide's
 * last step is explanatory, not an action: it points at the real Lifecycle
 * entry point and says what it is for, then lets the user finish with the
 * tooltip's own Next button rather than performing anything destructive.
 */
export const organizationsGuide: GuideDefinition = {
  id: "organizations",
  version: 1,
  title: "Organizations",
  description:
    "Create the institutional tenant everything else in CampusFlow — branches, users, academic years — lives underneath.",
  entryRoutes: [ROUTES.app.organizations.root],
  steps: [
    {
      id: "create-link",
      route: ROUTES.app.organizations.root,
      target: '[data-guide="organization-dashboard-create-link"]',
      title: "Create your organization",
      description:
        "An organization is the tenant CampusFlow multi-tenants around — the parent institution or trust. Every branch, user and setting you create afterward belongs to one. Start here.",
      placement: "bottom",
      advanceOn: "action",
    },
    {
      id: "create-submit",
      route: ROUTES.app.organizations.create,
      target: '[data-guide="organization-create-submit"]',
      title: "Save the organization",
      description:
        "Identity, contact and address are all you need to start. Create it to continue.",
      placement: "top",
      advanceOn: "action",
    },
    {
      id: "details-overview",
      route: ROUTES.app.organizations.detail(":id"),
      target: '[data-guide="organization-details-lifecycle-link"]',
      title: "It's active immediately",
      description:
        "This organization is already active — there's no activation step to complete. If you ever need to deactivate it, that's a soft delete managed from here, in Lifecycle; every branch underneath loses access, and nothing here reverses it, so it's worth knowing about even though you won't need it now.",
      placement: "bottom",
      advanceOn: "next-button",
    },
  ],
};
