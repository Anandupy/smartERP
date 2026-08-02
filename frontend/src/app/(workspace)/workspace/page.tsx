import type { Metadata } from "next";

import { SignOutButton } from "@/features/auth";
import { WorkspaceSelectionScreen } from "@/features/workspace";

export const metadata: Metadata = {
  title: "Choose your workspace",
};

/**
 * Workspace selection.
 *
 * Thin by design: the route's only job beyond metadata is composing the two
 * features that meet here. Sign-out belongs to `auth` and the screen belongs to
 * `workspace`, and neither may import the other — so the route, which may
 * import both, passes one into the other's slot.
 */
export default function WorkspacePage() {
  return <WorkspaceSelectionScreen sessionActions={<SignOutButton />} />;
}
