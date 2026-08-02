import { Lock, ShieldCheck, type LucideIcon } from "@/assets/icons";
import type { WorkspaceUnavailableReason } from "@/core/workspace";

/**
 * Reassurance shown on the workspace brand panel — the same promises the auth
 * screens make, restated at the moment the user is about to enter real data.
 */
export const WORKSPACE_ASSURANCES: readonly {
  icon: LucideIcon;
  label: string;
}[] = [
  { icon: ShieldCheck, label: "Secure session" },
  { icon: Lock, label: "Encrypted in transit" },
];

/**
 * Copy for each way a workspace can fail to exist.
 *
 * Keyed by the resolver's reason so the screen never re-derives which level is
 * missing — it looks the answer up. Each one names the level that came up empty
 * and points at the only person who can change it, because none of these are
 * states the user can retry their way out of.
 */
export const WORKSPACE_UNAVAILABLE_COPY: Record<
  WorkspaceUnavailableReason,
  { title: string; description: string }
> = {
  "no-organizations": {
    title: "No organizations assigned",
    description:
      "Your account is active, but it hasn't been mapped to any institution yet. An administrator can assign one.",
  },
  "no-branches": {
    title: "No campuses available",
    description:
      "This organization has no campus you can access. An administrator can grant you access to one.",
  },
  "no-academic-years": {
    title: "No academic years available",
    description:
      "This campus has no academic year set up yet. An administrator can create one before you continue.",
  },
};

/** Where "contact an administrator" goes. Matches the auth screens' support link. */
export const WORKSPACE_SUPPORT_EMAIL = "support@campusflow.example";
