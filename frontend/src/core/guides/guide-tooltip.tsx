"use client";

import type { TooltipRenderProps } from "react-joyride";

import { ArrowRight, CircleHelp, X } from "@/assets/icons";
import { Button } from "@/components/ui/button";

import type { GuideStepAdvanceMode } from "./types";

interface GuideStepData {
  advanceOn: GuideStepAdvanceMode;
  position: number;
  total: number;
}

function isGuideStepData(value: unknown): value is GuideStepData {
  return (
    typeof value === "object" &&
    value !== null &&
    "advanceOn" in value &&
    "position" in value &&
    "total" in value
  );
}

/**
 * CampusFlow's guide card — intentionally richer than a generic plugin
 * tooltip while staying inside the product's existing design language.
 */
export function GuideTooltip({
  step,
  primaryProps,
  skipProps,
  closeProps,
  tooltipProps,
}: TooltipRenderProps) {
  const data = isGuideStepData(step.data) ? step.data : null;
  const showNext = data?.advanceOn === "next-button";
  const progress = data
    ? Math.min(100, Math.max(0, (data.position / data.total) * 100))
    : 0;

  return (
    <div
      {...tooltipProps}
      className="bg-popover text-popover-foreground ring-foreground/10 w-88 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl p-0 text-sm shadow-xl ring-1"
    >
      <div className="bg-primary/5 border-primary/10 border-b px-4 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-primary flex min-w-0 items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            <span className="bg-primary/10 flex size-6 shrink-0 items-center justify-center rounded-full">
              <CircleHelp aria-hidden="true" className="size-3.5" />
            </span>
            <span>Guided tour</span>
          </div>
          <button
            {...closeProps}
            type="button"
            aria-label="Close guide"
            className="text-muted-foreground hover:bg-muted hover:text-foreground -mr-1 -mt-1 shrink-0 rounded-md p-1.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </div>

        {data ? (
          <div className="pt-3 pb-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs font-medium">
                Step {data.position} of {data.total}
              </p>
              <p className="text-muted-foreground text-xs">
                {Math.round(progress)}% complete
              </p>
            </div>
            <div
              className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"
              aria-hidden="true"
            >
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        {step.title ? (
          <div className="space-y-1">
            <p className="text-foreground text-base font-semibold tracking-tight">
              {step.title}
            </p>
            {showNext ? (
              <p className="text-primary text-xs font-medium">Next step</p>
            ) : (
              <p className="text-primary text-xs font-medium">Your turn</p>
            )}
          </div>
        ) : null}

        {step.content ? (
          <p className="text-muted-foreground text-sm leading-6">
            {step.content}
          </p>
        ) : null}

        {!showNext ? (
          <div className="bg-muted/50 ring-border/60 rounded-lg p-2.5 ring-1">
            <p className="text-muted-foreground text-xs leading-5">
              Complete the highlighted action in CampusFlow. I&apos;ll guide you
              to the next step automatically.
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            {...skipProps}
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            aria-label="Skip guide"
          >
            Skip guide
          </Button>
          {showNext ? (
            // `primaryProps.aria-label` is Joyride's own title for this
            // control ("Next", but "Last" on a guide's final step) — always
            // overridden here so the accessible name matches the button's
            // always-static visible text, the same fix `skipProps` needed.
            <Button
              {...primaryProps}
              type="button"
              size="sm"
              aria-label="Next"
            >
              Next
              <ArrowRight />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
