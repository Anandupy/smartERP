import type { Metadata } from "next";

import { Container } from "@/shared";

import { WorkspaceLanding } from "./workspace-landing";

export const metadata: Metadata = {
  title: "Workspace",
};

/**
 * Landing page for the authenticated app.
 *
 * A **placeholder**: it exists so the post-authentication flow has a
 * destination and can be walked end to end. The dashboard that replaces it is
 * the next phase — see `docs/workspace.md`.
 */
export default function AppLandingPage() {
  return (
    <Container size="md" className="flex flex-1 flex-col justify-center py-16">
      <WorkspaceLanding />
    </Container>
  );
}
