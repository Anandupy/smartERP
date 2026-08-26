import { beforeEach, describe, expect, it } from "vitest";

import { STORAGE_KEYS } from "@/constants";
import { useGuideStore } from "@/core/guides/guide-store";

/**
 * The guide store: run state (transient) vs completion records (persisted).
 *
 * `vitest.setup.ts` clears `localStorage` after every test; this file resets
 * the store's in-memory state before each test too, since the store itself is
 * a module-level singleton that otherwise carries over between specs.
 */
function resetStore() {
  useGuideStore.setState({
    activeGuideId: null,
    stepIndex: 0,
    entityId: null,
    status: "idle",
    completed: {},
  });
}

beforeEach(() => {
  resetStore();
});

describe("start", () => {
  it("begins at step 0, running, with no captured entity", () => {
    useGuideStore.getState().start("academic-years");

    const state = useGuideStore.getState();
    expect(state.activeGuideId).toBe("academic-years");
    expect(state.stepIndex).toBe(0);
    expect(state.entityId).toBeNull();
    expect(state.status).toBe("running");
  });

  it("resets any entity id left over from a previous run", () => {
    useGuideStore.setState({ entityId: "stale-id" });
    useGuideStore.getState().start("academic-years");

    expect(useGuideStore.getState().entityId).toBeNull();
  });
});

describe("setStep", () => {
  it("moves the step index forward", () => {
    useGuideStore.getState().start("academic-years");
    useGuideStore.getState().setStep(2);

    expect(useGuideStore.getState().stepIndex).toBe(2);
  });

  it("records the entity id when one is given", () => {
    useGuideStore.getState().start("academic-years");
    useGuideStore.getState().setStep(1, "ay-123");

    expect(useGuideStore.getState().entityId).toBe("ay-123");
  });

  it("keeps the existing entity id when none is given", () => {
    useGuideStore.getState().start("academic-years");
    useGuideStore.getState().setStep(1, "ay-123");
    useGuideStore.getState().setStep(2);

    expect(useGuideStore.getState().entityId).toBe("ay-123");
  });
});

describe("stop", () => {
  it("clears the run and records the given status", () => {
    useGuideStore.getState().start("academic-years");
    useGuideStore.getState().setStep(2, "ay-123");

    useGuideStore.getState().stop("skipped");

    const state = useGuideStore.getState();
    expect(state.activeGuideId).toBeNull();
    expect(state.stepIndex).toBe(0);
    expect(state.entityId).toBeNull();
    expect(state.status).toBe("skipped");
  });
});

describe("markCompleted", () => {
  it("records the version and a timestamp", () => {
    useGuideStore.getState().markCompleted("academic-years", 1);

    const record = useGuideStore.getState().completed["academic-years"];
    expect(record?.version).toBe(1);
    expect(record?.completedAt).toEqual(expect.any(String));
  });

  it("persists only completion records, never run state, to localStorage", () => {
    useGuideStore.getState().start("academic-years");
    useGuideStore.getState().setStep(2, "ay-123");
    useGuideStore.getState().markCompleted("academic-years", 1);

    const raw = window.localStorage.getItem(STORAGE_KEYS.guideProgress);
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw!) as {
      state: Record<string, unknown>;
    };
    expect(persisted.state).toEqual({
      completed: {
        "academic-years": {
          version: 1,
          completedAt: expect.any(String),
        },
      },
    });
    expect(persisted.state.activeGuideId).toBeUndefined();
    expect(persisted.state.stepIndex).toBeUndefined();
    expect(persisted.state.entityId).toBeUndefined();
  });

  it("lets a version bump make a completed guide eligible again", () => {
    useGuideStore.getState().markCompleted("academic-years", 1);
    const hasSeenV1 =
      useGuideStore.getState().completed["academic-years"]?.version === 1;
    expect(hasSeenV1).toBe(true);

    // A later guide edit bumps the shipped definition to version 2 — the
    // stored completion is still version 1, so `useGuide`'s `hasSeen`
    // comparison (definition.version === record.version) now reads false,
    // without anything here needing to delete or migrate the old record.
    const hasSeenV2 =
      useGuideStore.getState().completed["academic-years"]?.version === 2;
    expect(hasSeenV2).toBe(false);
  });
});
