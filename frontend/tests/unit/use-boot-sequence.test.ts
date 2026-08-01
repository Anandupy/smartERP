import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBootSequence } from "@/features/auth";

const STEPS = ["First", "Second", "Third"] as const;

/**
 * Advance whole steps one at a time. Each tick must settle in its own `act`:
 * the hook only schedules the next timer from the effect that runs after the
 * previous state update commits, so a single bulk advance would fire once.
 */
function advanceSteps(count: number, stepDurationMs = 100) {
  for (let index = 0; index < count; index += 1) {
    act(() => void vi.advanceTimersByTime(stepDurationMs));
  }
}

describe("useBootSequence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts on the first step with proportional progress", () => {
    const { result } = renderHook(() =>
      useBootSequence({ steps: STEPS, stepDurationMs: 100 }),
    );

    expect(result.current.label).toBe("First");
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.progress).toBe(33);
    expect(result.current.isComplete).toBe(false);
  });

  it("advances one step per interval and reports 100% on the last", () => {
    const { result } = renderHook(() =>
      useBootSequence({ steps: STEPS, stepDurationMs: 100 }),
    );

    advanceSteps(1);
    expect(result.current.label).toBe("Second");
    expect(result.current.progress).toBe(67);

    advanceSteps(1);
    expect(result.current.label).toBe("Third");
    expect(result.current.progress).toBe(100);
    expect(result.current.isComplete).toBe(false);
  });

  it("completes exactly once, after the final step has been displayed", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useBootSequence({ steps: STEPS, stepDurationMs: 100, onComplete }),
    );

    advanceSteps(STEPS.length - 1);
    expect(onComplete).not.toHaveBeenCalled();

    advanceSteps(1);
    expect(result.current.isComplete).toBe(true);
    expect(onComplete).toHaveBeenCalledTimes(1);

    // No further timers may fire once the sequence is done.
    advanceSteps(10);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("never completes when there are no steps", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useBootSequence({ steps: [], stepDurationMs: 100, onComplete }),
    );

    advanceSteps(10);
    expect(result.current.label).toBe("");
    expect(result.current.progress).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
