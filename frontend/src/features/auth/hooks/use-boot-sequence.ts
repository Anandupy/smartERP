"use client";

import { useEffect, useRef, useState } from "react";

export interface UseBootSequenceOptions {
  /** Ordered status lines; the sequence ends on the last one. */
  steps: readonly string[];
  /** How long each step is displayed before advancing. */
  stepDurationMs?: number;
  /** Called once, after the final step has been displayed. */
  onComplete?: () => void;
}

export interface BootSequenceState {
  /** Zero-based index of the step currently displayed. */
  stepIndex: number;
  /** The step currently displayed (empty when `steps` is empty). */
  label: string;
  /** Completion percentage (0–100), suitable for a determinate progress bar. */
  progress: number;
  /** `true` once the final step has been displayed. */
  isComplete: boolean;
}

/**
 * Drives the splash screen's staged boot sequence.
 *
 * Deliberately a timer, not a fake loading bar: it advances through real,
 * ordered status lines and reports determinate progress so the progress bar can
 * expose a meaningful `aria-valuenow`. Timing is unaffected by
 * `prefers-reduced-motion` — the sequence is information, not decoration; only
 * the screen's entrance animations respect that preference.
 *
 * When the platform gains real bootstrap work (session probe, workspace
 * resolution), each step becomes an awaited promise and this hook is the single
 * place that changes.
 */
export function useBootSequence({
  steps,
  stepDurationMs = 1_200,
  onComplete,
}: UseBootSequenceOptions): BootSequenceState {
  const [stepIndex, setStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Kept in a ref so a caller's inline callback never restarts the sequence.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (steps.length === 0 || isComplete) return;

    const isLastStep = stepIndex >= steps.length - 1;
    const timer = setTimeout(() => {
      if (isLastStep) {
        setIsComplete(true);
      } else {
        setStepIndex((index) => index + 1);
      }
    }, stepDurationMs);

    return () => clearTimeout(timer);
  }, [stepIndex, steps.length, stepDurationMs, isComplete]);

  useEffect(() => {
    if (isComplete) onCompleteRef.current?.();
  }, [isComplete]);

  return {
    stepIndex,
    label: steps[stepIndex] ?? "",
    progress:
      steps.length === 0
        ? 0
        : Math.round(((stepIndex + 1) / steps.length) * 100),
    isComplete,
  };
}
