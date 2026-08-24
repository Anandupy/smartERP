"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkspace, useWorkspaceStore } from "@/core/workspace";
import { Banner } from "@/shared/components/feedback";

import { ProvisionOrgAdminPanel } from "./provision-org-admin-panel";
import { SetupShell } from "./setup-shell";
import {
  buildSetupSteps,
  currentSetupStep,
  nextSetupHref,
} from "../utils/setup-steps";

export interface SetupWelcomeScreenProps {
  role: string | null;
  headerActions?: React.ReactNode;
}

/**
 * The wizard's entry point: what setup is, what's left, and where to go next.
 *
 * Resumable by construction — it reads the same `setupStatus` every step page
 * does, so a returning `ORG_ADMIN` sees exactly what is already done rather
 * than a restart. See `docs/workspace-setup-module.md`.
 */
export function SetupWelcomeScreen({
  role,
  headerActions,
}: SetupWelcomeScreenProps) {
  const setup = useWorkspaceStore((state) => state.setupStatus);
  const { options } = useWorkspace();

  if (!setup) {
    return (
      <SetupShell title="Preparing your setup…">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              Loading your workspace&apos;s setup status.
            </p>
          </CardContent>
        </Card>
      </SetupShell>
    );
  }

  const steps = buildSetupSteps(setup, role);
  const current = currentSetupStep(setup, role);
  const href = nextSetupHref(setup, role);
  const completedCount = steps.filter((step) => step.status === "complete").length;
  const canDelegate = role === "SUPER_ADMIN";

  return (
    <SetupShell
      title="Let's get your workspace ready"
      description="A few required steps stand between here and your dashboard. Nothing below is hidden — you can see exactly what's done and what's left."
      steps={steps}
      headerActions={headerActions}
    >
      <Card>
        <CardContent className="space-y-6 py-6">
          <p className="text-muted-foreground text-sm">
            {completedCount} of {steps.length} required steps complete.
          </p>

          {current && !current.actionable ? (
            <Banner
              tone="info"
              title="Waiting on your platform administrator"
              description={`${current.label} has not been set up yet, and only a platform administrator can do that. You'll be able to continue as soon as it's done — check back, or ask them directly.`}
            />
          ) : (
            <Button asChild size="lg" disabled={!href}>
              <Link href={href ?? "#"}>
                {current ? `Continue: ${current.label}` : "Review and finish"}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {canDelegate ? (
        <ProvisionOrgAdminPanel
          organizationOptions={options.organizations.map((organization) => ({
            value: organization.id,
            label: organization.name,
          }))}
        />
      ) : null}
    </SetupShell>
  );
}
