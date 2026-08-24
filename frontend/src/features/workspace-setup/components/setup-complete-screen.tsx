"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { useWorkspace } from "@/core/workspace";
import { SuccessState } from "@/shared/components/feedback";

export interface SetupCompleteScreenProps {
  onContinue?: () => void;
}

/**
 * Shown once `POST /workspace/setup/complete` has succeeded and identity has
 * been refreshed to `READY`.
 *
 * Deliberately thin: it names what was configured and then hands off to the
 * existing workspace flow (`ROUTES.workspace.root`) rather than building a
 * second workspace selector — see `docs/workspace-setup-module.md`.
 */
export function SetupCompleteScreen({ onContinue }: SetupCompleteScreenProps) {
  const { options } = useWorkspace();

  const organization = options.organizations[0];
  const branchCount = options.branches.length;
  const yearCount = options.academicYears.length;

  return (
    <div className="bg-muted/30 flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <SuccessState
          title="Your workspace is ready"
          description={
            organization
              ? `${organization.name} is set up with ${branchCount} branch${branchCount === 1 ? "" : "es"} and ${yearCount} academic year${yearCount === 1 ? "" : "s"}. Programs and academic units are still optional — configure them any time from the main menu.`
              : "Your workspace is set up. Programs and academic units are still optional — configure them any time from the main menu."
          }
          action={
            <Button asChild size="lg">
              <Link href={ROUTES.workspace.root} onClick={onContinue}>
                Go to your workspace
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
