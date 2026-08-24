"use client";

import { RequireSetupIncomplete } from "@/core/workspace";
import { PageSkeleton } from "@/shared/components/feedback";

/**
 * Gates the wizard's own steps (welcome, each resource step, review) on
 * `"setup-required"` — but not `/setup/complete`, which sits outside this
 * group precisely so it is not caught by the same redirect the moment
 * completion flips the status to `"ready"`. See `../../layout.tsx` and
 * `docs/workspace-setup-module.md`.
 */
export default function SetupWizardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireSetupIncomplete fallback={<PageSkeleton />}>
      {children}
    </RequireSetupIncomplete>
  );
}
