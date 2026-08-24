"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { useWorkspace } from "@/core/workspace";
import { FadeIn } from "@/shared";
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
      <FadeIn offsetY={16} className="w-full max-w-md space-y-6">
        <SuccessState
          title="CampusFlow is ready"
          description="Your organization is configured and your workspace is ready to use. Programs and academic units are still optional — configure them any time from the main menu."
        />

        {organization ? (
          <Card>
            <CardContent className="grid grid-cols-3 divide-x py-4 text-center">
              <div className="flex flex-col gap-0.5 px-2">
                <span className="text-foreground text-lg font-semibold">
                  1
                </span>
                <span className="text-muted-foreground text-xs">
                  Organization
                </span>
              </div>
              <div className="flex flex-col gap-0.5 px-2">
                <span className="text-foreground text-lg font-semibold tabular-nums">
                  {branchCount}
                </span>
                <span className="text-muted-foreground text-xs">
                  Branch{branchCount === 1 ? "" : "es"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 px-2">
                <span className="text-foreground text-lg font-semibold tabular-nums">
                  {yearCount}
                </span>
                <span className="text-muted-foreground text-xs">
                  Academic year{yearCount === 1 ? "" : "s"}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Button asChild size="lg" className="w-full">
          <Link href={ROUTES.workspace.root} onClick={onContinue}>
            Continue to Workspace
          </Link>
        </Button>
      </FadeIn>
    </div>
  );
}
