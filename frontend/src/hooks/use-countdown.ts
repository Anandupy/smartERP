"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseCountdownOptions {
  /** Seconds to count down from. */
  seconds: number;
  /** Start ticking immediately. Set `false` to wait for `restart()`. */
  autoStart?: boolean;
  /** Called once when the countdown reaches zero. */
  onComplete?: () => void;
}

export interface Countdown {
  /** Whole seconds remaining. */
  remaining: number;
  /** `mm:ss`, suitable for display. */
  formatted: string;
  /** `true` once `remaining` hits zero. */
  isComplete: boolean;
  /** Restart from `seconds` (or an explicit override). */
  restart: (seconds?: number) => void;
}

function format(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Generic one-second countdown used by resend throttles and lockout timers.
 *
 * Ticks on an interval rather than deriving from a deadline, which keeps it
 * trivially testable with fake timers; it is only ever used for short,
 * foreground durations where clock drift is not a concern.
 */
export function useCountdown({
  seconds,
  autoStart = true,
  onComplete,
}: UseCountdownOptions): Countdown {
  const [remaining, setRemaining] = useState(autoStart ? seconds : 0);
  const [isRunning, setIsRunning] = useState(autoStart);

  // Kept in a ref so an inline callback never restarts the interval.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          clearInterval(timer);
          setIsRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1_000);

    return () => clearInterval(timer);
  }, [isRunning]);

  const isComplete = remaining === 0;

  const wasComplete = useRef(isComplete);
  useEffect(() => {
    if (isComplete && !wasComplete.current) onCompleteRef.current?.();
    wasComplete.current = isComplete;
  }, [isComplete]);

  const restart = useCallback(
    (nextSeconds?: number) => {
      setRemaining(nextSeconds ?? seconds);
      setIsRunning(true);
    },
    [seconds],
  );

  return { remaining, formatted: format(remaining), isComplete, restart };
}
