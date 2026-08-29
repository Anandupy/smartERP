import { ROUTES } from "@/constants";
import type { GuideDefinition } from "@/core/guides";

/**
 * The Menu Details reference guide.
 *
 * Gated to `SUPER_ADMIN`, same as `workspace-modules` (`MenusScreen` enforces
 * this itself). Creating a menu opens `CreateMenuDialog`, a Radix dialog, not
 * a route — the guide deliberately never spotlights a control inside it: a
 * modal already takes priority over the tour (`docs/guides.md` "Modal
 * priority"), and the safest way to honor that here is to not compete with
 * it for the user's attention at all. Both steps are explanatory
 * (`"next-button"`); the dialog itself, once opened, is on its own.
 */
export const workspaceMenusGuide: GuideDefinition = {
  id: "workspace-menus",
  version: 1,
  title: "Menu Details",
  description:
    "The menu hierarchy of one module — module, menu, submenu, up to three levels deep.",
  entryRoutes: [ROUTES.app.workspaceAdmin.menus.root],
  requirement: ({ permissions }) => permissions.hasRole("SUPER_ADMIN"),
  steps: [
    {
      id: "module-select",
      route: ROUTES.app.workspaceAdmin.menus.root,
      target: '[data-guide="workspace-menus-module-select"]',
      title: "Pick a module",
      description:
        "A menu's parent can only be another menu in the same module — there's no cross-module tree. Switch modules here to see a different one's hierarchy.",
      placement: "bottom",
      advanceOn: "next-button",
    },
    {
      id: "create-link",
      route: ROUTES.app.workspaceAdmin.menus.root,
      target: '[data-guide="workspace-menus-create-link"]',
      title: "Add a menu",
      description:
        "This opens a dialog where you name it, set its route, and choose where it sits in the hierarchy. Fill it in and save to add your first menu.",
      placement: "bottom",
      advanceOn: "next-button",
    },
  ],
};
