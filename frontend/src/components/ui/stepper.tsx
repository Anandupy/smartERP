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

export interface StepperProps extends Omit<React.ComponentProps<"div">, "children"> {
  steps: StepperStep[];
}

/**
 * A sequence of named steps with a completed/current/upcoming state each.
 *
 * Presentation only — callers decide what the steps are and what "current"
 * means; this never encodes navigation or business rules.
 * `aria-current="step"` on the current item and list ordering carry the
 * semantics screen readers need instead of color alone.
 *
 * Two layouts, not one compressed to fit both: below `sm` a four-or-more-word
 * label and a horizontal rail cannot coexist without truncating one of them,
 * so mobile gets a compact "Step X of Y" readout with a progress bar instead
 * of a shrunk copy of the desktop rail. Desktop keeps every label — and its
 * description — fully visible by wrapping onto two lines rather than
 * truncating, since a clipped step name is exactly the kind of essential text
 * a tooltip should never be the only way to read.
 */
function Stepper({ steps, className, ...props }: StepperProps) {
  const currentIndex = steps.findIndex((step) => step.status === "current");
  const completedCount = steps.filter((step) => step.status === "complete").length;
  const displayIndex = currentIndex >= 0 ? currentIndex : steps.length - 1;
  const current = steps[displayIndex];
  const progressPercent = Math.round(((displayIndex + (currentIndex >= 0 ? 0 : 1)) / steps.length) * 100);

  return (
    <div data-slot="stepper" className={cn(className)} {...props}>
      {/* Mobile: compact readout. */}
      <div className="sm:hidden" role="group" aria-label="Setup progress">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            Step {displayIndex + 1} of {steps.length}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {completedCount}/{steps.length} done
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
          className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {current ? (
          <p className="text-foreground mt-2 text-sm font-medium">
            {current.label}
          </p>
        ) : null}
      </div>

      {/* Desktop: full timeline, every label fully visible. */}
      <ol
        aria-label="Progress"
        className="hidden sm:flex sm:items-start sm:gap-1"
      >
        {steps.map((step, index) => (
          <li
            key={step.key}
            aria-current={step.status === "current" ? "step" : undefined}
            className="flex min-w-0 flex-1 flex-col items-center gap-2 px-1 text-center"
          >
            <div className="flex w-full items-center">
              <span
                aria-hidden="true"
                className={cn(
                  "h-px flex-1 rounded-full",
                  index === 0
                    ? "opacity-0"
                    : steps[index - 1].status === "complete"
                      ? "bg-primary"
                      : "bg-border",
                )}
              />
              <span
                data-slot="stepper-indicator"
                data-status={step.status}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums transition-colors",
                  step.status === "complete" &&
                    "border-primary bg-primary text-primary-foreground",
                  step.status === "current" &&
                    "border-primary text-primary bg-primary/10 ring-primary/20 ring-4",
                  step.status === "upcoming" &&
                    "border-border text-muted-foreground bg-background",
                )}
              >
                {step.status === "complete" ? (
                  <CheckIcon aria-hidden="true" className="size-4" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "h-px flex-1 rounded-full",
                  index === steps.length - 1
                    ? "opacity-0"
                    : step.status === "complete"
                      ? "bg-primary"
                      : "bg-border",
                )}
              />
            </div>

            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "text-xs leading-tight font-medium break-words sm:text-sm",
                  step.status === "current" && "text-primary",
                  step.status === "complete" && "text-foreground",
                  step.status === "upcoming" && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              {step.description ? (
                <span className="text-muted-foreground mt-0.5 hidden text-xs leading-tight break-words lg:block">
                  {step.description}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export { Stepper };
