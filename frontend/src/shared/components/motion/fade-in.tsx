"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * React's drag/animation DOM handlers collide with Motion's same-named props,
 * which carry different signatures. They are dropped here so one prop set is
 * valid for both the animated and the reduced-motion (plain `div`) branch.
 */
type DivPropsWithoutMotionConflicts = Omit<
  React.ComponentProps<"div">,
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "style"
>;

export interface FadeInProps extends DivPropsWithoutMotionConflicts {
  /** Seconds to wait before the animation starts. */
  delay?: number;
  /** Pixels to travel upward while fading in. `0` gives a pure fade. */
  offsetY?: number;
  /** Seconds the animation runs for. */
  duration?: number;
}

/**
 * Entrance animation primitive: a subtle fade + rise, honoring
 * `prefers-reduced-motion` by rendering the final state immediately.
 *
 * Generic and presentational — features compose it for staged reveals instead
 * of re-deriving motion variants and the reduced-motion guard each time.
 */
export function FadeIn({
  delay = 0,
  offsetY = 12,
  duration = 0.5,
  className,
  children,
  ...props
}: FadeInProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div className={cn(className)} {...props}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: offsetY }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
