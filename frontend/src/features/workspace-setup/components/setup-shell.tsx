"use client";

import { Stepper, type StepperStep } from "@/components/ui/stepper";
import { Card, CardContent } from "@/components/ui/card";
import { BrandMark, FadeIn } from "@/shared";

export interface SetupShellProps {
  title: string;
  description?: string;
  /** Omit on the welcome/complete bookends, which do not belong to one step. */
  steps?: StepperStep[];
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared chrome for every setup-wizard screen: brand mark, the step
 * indicator, a heading, and the step's own content.
 *
 * Deliberately not the `(app)` dashboard shell — no sidebar, no navigation.
 * Setup is a focused, linear task, not a place to browse the rest of the ERP;
 * see `docs/workspace-setup-module.md`.
 */
export function SetupShell({
  title,
  description,
  steps,
  headerActions,
  children,
}: SetupShellProps) {
  return (
    <div className="bg-muted/30 min-h-dvh">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <BrandMark size="sm" />
          {headerActions}
        </header>

        {steps ? (
          <Card>
            <CardContent className="py-4 sm:py-5">
              <Stepper steps={steps} />
            </CardContent>
          </Card>
        ) : null}

        <FadeIn className="space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {description ? (
              <p className="text-muted-foreground text-sm">{description}</p>
            ) : null}
          </div>
          {children}
        </FadeIn>
      </div>
    </div>
  );
}
