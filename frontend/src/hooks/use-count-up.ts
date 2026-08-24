import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Animates a number counting up to `target` over `duration` seconds.
 *
 * Returns `target` directly, bypassing the animated state entirely, when the
 * viewer prefers reduced motion — counting is decorative, never
 * load-bearing, so skipping it changes nothing about what the number means.
 */
export function useCountUp(target: number, duration = 0.6): number {
  const prefersReducedMotion = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let frame: number;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      setValue(Math.round(target * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, prefersReducedMotion]);

  return prefersReducedMotion ? target : value;
}
