import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCountdown } from "@/hooks";

/** One tick per `act`, so each state update commits before the next fires. */
function tick(seconds: number) {
  for (let index = 0; index < seconds; index += 1) {
    act(() => void vi.advanceTimersByTime(1_000));
  }
}

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats the remaining time as mm:ss", () => {
    const { result } = renderHook(() => useCountdown({ seconds: 125 }));
    expect(result.current.formatted).toBe("02:05");
    expect(result.current.isComplete).toBe(false);
  });

  it("counts down and completes exactly once", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useCountdown({ seconds: 3, onComplete }),
    );

    tick(2);
    expect(result.current.remaining).toBe(1);
    expect(onComplete).not.toHaveBeenCalled();

    tick(1);
    expect(result.current.remaining).toBe(0);
    expect(result.current.formatted).toBe("00:00");
    expect(result.current.isComplete).toBe(true);
    expect(onComplete).toHaveBeenCalledTimes(1);

    tick(5);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("starts complete when autoStart is off", () => {
    const { result } = renderHook(() =>
      useCountdown({ seconds: 10, autoStart: false }),
    );
    expect(result.current.isComplete).toBe(true);

    tick(3);
    expect(result.current.remaining).toBe(0);
  });

  it("restarts on demand, optionally with a different duration", () => {
    const { result } = renderHook(() => useCountdown({ seconds: 2 }));

    tick(2);
    expect(result.current.isComplete).toBe(true);

    act(() => result.current.restart());
    expect(result.current.remaining).toBe(2);
    expect(result.current.isComplete).toBe(false);

    act(() => result.current.restart(30));
    expect(result.current.formatted).toBe("00:30");
  });
});
