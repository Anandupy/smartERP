"use client";

import type { TooltipRenderProps } from "react-joyride";

import { ArrowRight, X } from "@/assets/icons";
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
 * CampusFlow's guide card — replaces Joyride's default tooltip entirely.
 *
 * Styled with the same surface/ring/shadow tokens as `PopoverContent`, so a
 * guide reads as a native part of the product rather than a plugin. Buttons
 * are the platform `Button`, spread with Joyride's own `*Props` so focus
 * rings, `aria-label`s and keyboard operability come for free.
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

  return (
    <div
      {...tooltipProps}
      className="bg-popover text-popover-foreground ring-foreground/10 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg p-4 text-sm shadow-lg ring-1"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {data ? (
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Step {data.position} of {data.total}
            </p>
          ) : null}
          {step.title ? (
            <p className="text-foreground font-heading text-sm font-medium">
              {step.title}
            </p>
          ) : null}
        </div>
        <button
          {...closeProps}
          type="button"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -m-1 shrink-0 rounded-md p-1 outline-none focus-visible:ring-3"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {step.content ? (
        <p className="text-muted-foreground text-sm">{step.content}</p>
      ) : null}

      {!showNext ? (
        <p className="text-muted-foreground text-xs italic">
          Complete this step in the app to continue.
        </p>
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
  );
}
