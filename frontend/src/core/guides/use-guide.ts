"use client";

import { useMemo } from "react";

import { usePermissions } from "@/core/auth";
import { useWorkspace } from "@/core/workspace";

import { getGuide } from "./registry";
import { useGuideStore } from "./guide-store";

export interface UseGuideResult {
  /** The guide exists and its `requirement` (if any) passes for this user. */
  isAvailable: boolean;
  /** This guide is the one currently running. */
  isActive: boolean;
  /** The user completed the guide at its current `version`. */
  hasSeen: boolean;
  /** Begins the guide at its first step. */
  startGuide: () => void;
  /**
   * Advances past an "action" step: call after the real, already-existing
   * success handling for that step's action has finished. Pass `entityId`
   * when the action just revealed the record a later, id-scoped step should
   * target (e.g. the id of a just-created record) — later steps whose route
   * carries a dynamic segment only ever match against this id, so browsing to
   * an unrelated record's page mid-guide can never make it jump ahead.
   * Completes the guide automatically when this was the last step.
   */
  reportEvent: (options?: { entityId?: string }) => void;
  /** Ends the guide immediately and marks it complete. */
  completeGuide: () => void;
}

/**
 * The only thing feature code needs to know about the guide platform.
 *
 * A screen says "start the academic-years guide" or "this action completes
 * it" — it never touches Joyride, the registry, or persistence directly. See
 * `docs/guides.md`.
 */
export function useGuide(guideId: string): UseGuideResult {
  const permissions = usePermissions();
  const workspace = useWorkspace();

  const activeGuideId = useGuideStore((state) => state.activeGuideId);
  const stepIndex = useGuideStore((state) => state.stepIndex);
  const completionRecord = useGuideStore(
    (state) => state.completed[guideId],
  );
  const start = useGuideStore((state) => state.start);
  const setStep = useGuideStore((state) => state.setStep);
  const stop = useGuideStore((state) => state.stop);
  const markCompleted = useGuideStore((state) => state.markCompleted);

  return useMemo<UseGuideResult>(() => {
    const definition = getGuide(guideId);
    const isAvailable = Boolean(
      definition &&
        (!definition.requirement ||
          definition.requirement({ permissions, workspace })),
    );
    const isActive = activeGuideId === guideId;
    const hasSeen = Boolean(
      definition && completionRecord?.version === definition.version,
    );

    const finish = () => {
      if (!definition) return;
      stop("completed");
      markCompleted(guideId, definition.version);
    };

    return {
      isAvailable,
      isActive,
      hasSeen,
      startGuide: () => {
        if (definition) start(guideId);
      },
      reportEvent: (options) => {
        if (!definition || !isActive) return;
        const nextIndex = stepIndex + 1;
        if (nextIndex >= definition.steps.length) finish();
        else setStep(nextIndex, options?.entityId);
      },
      completeGuide: finish,
    };
  }, [
    guideId,
    permissions,
    workspace,
    activeGuideId,
    stepIndex,
    completionRecord,
    start,
    setStep,
    stop,
    markCompleted,
  ]);
}
