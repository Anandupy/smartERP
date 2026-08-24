"use client";

import { motion, useReducedMotion } from "motion/react";

import { useCountUp } from "@/hooks";

export interface SetupProgressSummaryProps {
  completed: number;
  total: number;
}

/**
 * The welcome screen's progress visual: a percentage, counting up on
 * mount, over a bar that draws in to match — a subtle, one-time nod to the
 * Stitch reference's percentage/curve concept, built from plain divs rather
 * than an SVG gauge so it stays a small supporting detail, not a dominant
 * graphic. Both this component would use the same `completedResources /
 * SETUP_RESOURCES.length` the stepper already derives from, so the number
 * can never disagree with the steps below it.
 */
export function SetupProgressSummary({
  completed,
  total,
}: SetupProgressSummaryProps) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const displayPercent = useCountUp(percent);
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex items-baseline gap-1 sm:flex-col sm:items-start sm:gap-0">
        <span className="text-foreground text-4xl font-semibold tabular-nums">
          {displayPercent}%
        </span>
        <span className="text-muted-foreground text-xs whitespace-nowrap sm:text-sm">
          setup progress
        </span>
      </div>
      <div className="flex-1 space-y-1.5">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
          className="bg-muted h-2 w-full overflow-hidden rounded-full"
        >
          <motion.div
            className="bg-primary h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
            }
          />
        </div>
        <p className="text-muted-foreground text-sm">
          {completed} of {total} required steps complete
        </p>
      </div>
    </div>
  );
}
