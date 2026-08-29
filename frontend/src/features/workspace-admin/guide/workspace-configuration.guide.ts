import { ROUTES } from "@/constants";
import type { GuideDefinition } from "@/core/guides";

/**
 * The Configuration Layer Editor reference guide.
 *
 * Gated to `SUPER_ADMIN`, mirroring the backend's own `@Roles(SUPER_ADMIN)`
 * on `POST /workspace/configuration` (see the screen's own comment). Two
 * steps: the merge-order concept (Product → Organization → Branch → Role →
 * User, later layers override earlier ones — this is the genuinely
 * non-obvious part of the page) and the save itself. The submit step
 * targets the whole `<form>`, not the Save button — the scope picker and
 * every preference field need to stay interactive while it's shown.
 * There's no further route to continue to, so it completes the guide
 * directly, the same shape as `numbering`.
 */
export const workspaceConfigurationGuide: GuideDefinition = {
  id: "workspace-configuration",
  version: 1,
  title: "Configuration Layer Editor",
  description:
    "Define one layer of workspace configuration — product-wide, or narrowed to an organization, branch, role or user.",
  entryRoutes: [ROUTES.app.workspaceAdmin.configuration],
  requirement: ({ permissions }) => permissions.hasRole("SUPER_ADMIN"),
  steps: [
    {
      id: "merge-order",
      route: ROUTES.app.workspaceAdmin.configuration,
      target: '[data-guide="workspace-configuration-merge-order"]',
      title: "How layers combine",
      description:
        "Later layers override earlier ones, one key at a time — a Branch layer only needs to set what's different from Product, not repeat everything. Pick a scope below to see what's already saved for it.",
      placement: "bottom",
      advanceOn: "next-button",
    },
    {
      id: "submit",
      route: ROUTES.app.workspaceAdmin.configuration,
      target: '[data-guide="workspace-configuration-submit"]',
      title: "Save the layer",
      description:
        "Every save merges into whatever already exists for the chosen scope — a field left on “Leave unchanged” is never sent, so it stays untouched.",
      advanceOn: "action",
    },
  ],
};
