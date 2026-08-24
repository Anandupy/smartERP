import * as React from "react";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type StepperStepStatus = "complete" | "current" | "upcoming";

export interface StepperStep {
  key: string;
  label: string;
  description?: string;
  status: StepperStepStatus;
}

export interface StepperProps extends Omit<React.ComponentProps<"ol">, "children"> {
  steps: StepperStep[];
  orientation?: "horizontal" | "vertical";
}

/**
 * A sequence of named steps with a completed/current/upcoming state each.
 *
 * Presentation only — callers decide what the steps are and what "current"
 * means; this never encodes navigation or business rules. `aria-current="step"`
 * on the current item and `<ol>` ordering carry the semantics screen readers
 * need instead of color alone.
 */
function Stepper({
  steps,
  orientation = "horizontal",
  className,
  ...props
}: StepperProps) {
  return (
    <ol
      data-slot="stepper"
      data-orientation={orientation}
      aria-label="Progress"
      className={cn(
        "flex gap-x-2 gap-y-4",
        orientation === "horizontal"
          ? "flex-row flex-wrap items-start"
          : "flex-col",
        className,
      )}
      {...props}
    >
      {steps.map((step, index) => (
        <li
          key={step.key}
          aria-current={step.status === "current" ? "step" : undefined}
          className={cn(
            "flex items-center gap-2",
            orientation === "horizontal" && "min-w-0 flex-1",
          )}
        >
          <span
            data-slot="stepper-indicator"
            data-status={step.status}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
              step.status === "complete" &&
                "border-primary bg-primary text-primary-foreground",
              step.status === "current" &&
                "border-primary text-primary bg-primary/10",
              step.status === "upcoming" &&
                "border-border text-muted-foreground",
            )}
          >
            {step.status === "complete" ? (
              <CheckIcon aria-hidden="true" className="size-4" />
            ) : (
              index + 1
            )}
          </span>

          <span className="flex min-w-0 flex-col">
            <span
              className={cn(
                "truncate text-sm font-medium",
                step.status === "upcoming"
                  ? "text-muted-foreground"
                  : "text-foreground",
              )}
            >
              {step.label}
            </span>
            {step.description ? (
              <span className="text-muted-foreground truncate text-xs">
                {step.description}
              </span>
            ) : null}
          </span>

          {orientation === "horizontal" && index < steps.length - 1 ? (
            <span
              aria-hidden="true"
              data-slot="stepper-connector"
              className={cn(
                "hidden h-px flex-1 sm:block",
                step.status === "complete" ? "bg-primary" : "bg-border",
              )}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export { Stepper };
