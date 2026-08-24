"use client";

import { useState } from "react";

import { CheckCircle2, Circle, TriangleAlert } from "@/assets/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace, useWorkspaceStore } from "@/core/workspace";
import { getErrorMessage } from "@/lib";
import { Banner, Spinner } from "@/shared/components/feedback";

import { SetupShell } from "./setup-shell";
import { useCompleteSetup } from "../hooks/use-complete-setup";
import { canCompleteSetup } from "../utils/setup-access";
import { buildSetupSteps } from "../utils/setup-steps";

export interface SetupReviewScreenProps {
  role: string | null;
  onCompleted: () => void;
}

/**
 * The last stop before `POST /workspace/setup/complete`.
 *
 * This screen decides nothing about whether setup is valid — the button below
 * calls the backend and shows exactly what it says. A `409` here means another
 * transition finished first or a resource disappeared between page loads;
 * either way, the message is the backend's own, not a guess.
 */
export function SetupReviewScreen({ role, onCompleted }: SetupReviewScreenProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const setup = useWorkspaceStore((state) => state.setupStatus);
  const { organization, options } = useWorkspace();
  const complete = useCompleteSetup();

  if (!setup) return null;

  const steps = buildSetupSteps(setup, role);
  const allComplete = setup.missingResources.length === 0;
  const mayComplete = canCompleteSetup(role);

  const handleComplete = async () => {
    setSubmitError(null);
    try {
      await complete.mutateAsync();
      onCompleted();
    } catch (error) {
      setSubmitError(error);
    }
  };

  return (
    <SetupShell
      title="Review your setup"
      description="Everything below is read from your workspace, not entered here — this screen only summarizes it."
      steps={steps}
    >
      <Card>
        <CardHeader>
          <CardTitle>Required foundation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {steps.map((step) => (
            <div
              key={step.key}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm"
            >
              {step.status === "complete" ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="text-primary size-5 shrink-0"
                />
              ) : (
                <Circle
                  aria-hidden="true"
                  className="text-muted-foreground/50 size-5 shrink-0"
                />
              )}
              <span className="flex-1 font-medium">{step.label}</span>
              <span
                className={
                  step.status === "complete"
                    ? "text-primary font-medium"
                    : "text-muted-foreground"
                }
              >
                {step.status === "complete" ? "Done" : "Not yet"}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-muted/40">
        <CardHeader>
          <CardTitle>Optional configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Programs and academic units are not required to finish setup. Once
            your workspace is ready, configure them from Programs and Academic
            Units in the normal menu — whenever suits you.
          </p>
          {organization ? (
            <div className="flex gap-6 text-sm">
              <span>
                <span className="text-foreground font-semibold tabular-nums">
                  {options.branches.length}
                </span>{" "}
                <span className="text-muted-foreground">branch(es)</span>
              </span>
              <span>
                <span className="text-foreground font-semibold tabular-nums">
                  {options.academicYears.length}
                </span>{" "}
                <span className="text-muted-foreground">academic year(s)</span>
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {submitError ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Could not finish setup</AlertTitle>
          <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
        </Alert>
      ) : null}

      {!allComplete ? (
        <Banner
          tone="warning"
          title="Required steps are still missing"
          description="Finish every step above before this can be completed."
        />
      ) : !mayComplete ? (
        <Banner
          tone="info"
          title="Waiting on your platform administrator"
          description="Every required step is done. Only a platform administrator can finish activating the workspace — let them know it's ready."
        />
      ) : (
        <div className="flex justify-end">
          <Button
            size="lg"
            disabled={complete.isPending}
            onClick={() => void handleComplete()}
          >
            {complete.isPending ? (
              <Spinner size="sm" label="Completing setup" />
            ) : null}
            {complete.isPending ? "Completing…" : "Complete Setup"}
          </Button>
        </div>
      )}
    </SetupShell>
  );
}
