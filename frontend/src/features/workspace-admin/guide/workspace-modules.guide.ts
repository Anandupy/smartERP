import { ROUTES } from "@/constants";
import type { GuideDefinition } from "@/core/guides";

/**
 * The Navigation Modules reference guide.
 *
 * Gated to `SUPER_ADMIN` — the same role `ModulesScreen`/`CreateModuleScreen`
 * already enforce (`docs/backend-gaps.md` notes the backend mirrors this on
 * `admin/navigation/modules`). This is the first guide with a `requirement`;
 * it reads `permissions.hasRole("SUPER_ADMIN")` rather than any hardcoded
 * role list, per `core/guides/types.ts`'s `GuideEvalContext` contract.
 *
 * The create-submit step targets the whole `<form>`, not the submit button —
 * Code/Icon/Display order all need to stay interactive while this step is
 * shown (see docs/guides.md "Guide target reliability"). The last step is
 * explanatory (Type B — a `"next-button"` Finish), not an action: "View
 * menus" crosses into the Menu Details screen, which has its own guide
 * ("workspace-menus") rather than this one reaching into it.
 */
export const workspaceModulesGuide: GuideDefinition = {
  id: "workspace-modules",
  version: 1,
  title: "Navigation Modules",
  description:
    "Register the top-level ERP capabilities your navigation is built from, then add menus underneath each one.",
  entryRoutes: [ROUTES.app.workspaceAdmin.modules.root],
  requirement: ({ permissions }) => permissions.hasRole("SUPER_ADMIN"),
  steps: [
    {
      id: "list-create-link",
      route: ROUTES.app.workspaceAdmin.modules.root,
      target: '[data-guide="workspace-modules-list-create-link"]',
      title: "Register a module",
      description:
        "A module is a top-level ERP capability — Admissions, Documents, and so on. Everything in navigation sits underneath one. Start here.",
      placement: "bottom",
      advanceOn: "action",
    },
    {
      id: "create-submit",
      route: ROUTES.app.workspaceAdmin.modules.create,
      target: '[data-guide="workspace-modules-create-submit"]',
      title: "Save the module",
      description:
        "Name and code it, then optionally set an icon and where it sorts among other modules. Create it to continue.",
      advanceOn: "action",
    },
    {
      id: "detail-view-menus",
      route: ROUTES.app.workspaceAdmin.modules.detail(":id"),
      target: '[data-guide="workspace-modules-detail-view-menus"]',
      title: "Add menus next",
      description:
        "A module on its own has nothing to navigate to yet — menus are the actual destinations inside it. Open View menus to add the first one; the Menu Details guide covers that screen.",
      placement: "bottom",
      advanceOn: "next-button",
    },
  ],
};
