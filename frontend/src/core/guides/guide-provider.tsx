"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import {
  ACTIONS,
  EVENTS,
  Joyride,
  type EventData,
  type Step,
} from "react-joyride";

import { GuideTooltip } from "./guide-tooltip";
import { useGuideStore } from "./guide-store";
import { getGuide } from "./registry";
import { extractRouteParam, matchesRoute } from "./route-match";
import type { GuideStep } from "./types";
import { useGuide } from "./use-guide";

const NO_ACTIVE_GUIDE = "__campusflow-no-active-guide__";

/** A visible ring the guide adds to the real target element, alongside
 * Joyride's own dimmed-overlay cutout (which masks the backdrop, not the
 * element). Written as literal class names so Tailwind's scanner keeps them
 * in the build despite the dynamic `classList` call below. */
const GUIDE_TARGET_RING_CLASSES = [
  "ring-2",
  "ring-primary",
  "ring-offset-2",
  "ring-offset-background",
  "rounded-md",
];

/**
 * Whether a step is reachable at the current pathname.
 *
 * A step whose route carries a dynamic segment (`:id`) only matches once the
 * guide has actually captured that id — see `entityId` on the store — and
 * only when the pathname's id is that exact one. Without this, a guide that
 * has not yet created its record could be fooled into treating an unrelated
 * existing record's page as "the next step."
 */
function stepMatchesPathname(
  step: GuideStep,
  pathname: string,
  entityId: string | null,
): boolean {
  if (!matchesRoute(step.route, pathname)) return false;
  if (!step.route.includes(":id")) return true;
  if (!entityId) return false;
  return extractRouteParam(step.route, pathname, "id") === entityId;
}

/**
 * Mounts the one Joyride instance for the authenticated app.
 *
 * Renders at most one step at a time — the current logical step, and only
 * once its route matches where the user actually is. A guide's steps almost
 * always span more than one route (see `docs/guides.md`), so on every
 * navigation this also catches the stored step index up to whichever step (at
 * or after it) the new pathname satisfies, which is what lets a step like
 * "now activate it" appear automatically once the user follows a real link
 * there — no synthetic "Next" button standing in for the actual UI control.
 *
 * Does not decide *when* a guide starts; that is always an explicit
 * `useGuide(id).startGuide()` call from feature UI (the Help drawer today).
 */
export function GuideProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const activeGuideId = useGuideStore((state) => state.activeGuideId);
  const stepIndex = useGuideStore((state) => state.stepIndex);
  const entityId = useGuideStore((state) => state.entityId);
  const status = useGuideStore((state) => state.status);
  const setStep = useGuideStore((state) => state.setStep);
  const stop = useGuideStore((state) => state.stop);
  const guide = useGuide(activeGuideId ?? NO_ACTIVE_GUIDE);

  const definition = activeGuideId ? getGuide(activeGuideId) : undefined;

  // Catch the floor up to whichever step the current route satisfies. Runs
  // on every navigation; a no-op once the stored step already matches.
  useEffect(() => {
    if (!definition || status !== "running") return;
    for (let index = stepIndex; index < definition.steps.length; index += 1) {
      if (stepMatchesPathname(definition.steps[index], pathname, entityId)) {
        if (index !== stepIndex) setStep(index, entityId ?? undefined);
        return;
      }
    }
  }, [definition, status, pathname, stepIndex, entityId, setStep]);

  const currentStep = definition?.steps[stepIndex];
  const isOnCurrentStep = Boolean(
    currentStep && stepMatchesPathname(currentStep, pathname, entityId),
  );

  const steps = useMemo<Step[]>(() => {
    if (!definition || !currentStep || !isOnCurrentStep) return [];
    return [
      {
        target: currentStep.target,
        title: currentStep.title,
        content: currentStep.description,
        placement: currentStep.placement ?? "bottom",
        data: {
          advanceOn: currentStep.advanceOn,
          position: stepIndex + 1,
          total: definition.steps.length,
        },
      },
    ];
  }, [definition, currentStep, isOnCurrentStep, stepIndex]);

  const run = status === "running" && steps.length > 0;

  useEffect(() => {
    if (!run || !currentStep) return;
    const element = document.querySelector<HTMLElement>(currentStep.target);
    if (!element) return;
    element.classList.add(...GUIDE_TARGET_RING_CLASSES);
    return () => {
      element.classList.remove(...GUIDE_TARGET_RING_CLASSES);
    };
  }, [run, currentStep]);

  return (
    <>
      {children}
      <Joyride
        run={run}
        steps={steps}
        stepIndex={0}
        continuous
        tooltipComponent={GuideTooltip}
        options={{
          skipBeacon: true,
          showProgress: false,
          spotlightPadding: 6,
          spotlightRadius: 10,
          targetWaitTimeout: 6000,
          overlayColor: "var(--overlay-scrim)",
        }}
        onEvent={(data: EventData) => {
          if (data.type === EVENTS.STEP_AFTER && data.action === ACTIONS.NEXT) {
            guide.reportEvent();
            return;
          }
          if (
            data.type === EVENTS.TOUR_END &&
            (data.action === ACTIONS.SKIP || data.action === ACTIONS.CLOSE)
          ) {
            stop("skipped");
            return;
          }
          if (data.type === EVENTS.TARGET_NOT_FOUND) {
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                `[core/guides] Target not found for ${activeGuideId ?? "?"}:${currentStep?.id ?? "?"} (${currentStep?.target ?? "?"}) — ending the guide.`,
              );
            }
            stop("skipped");
          }
        }}
      />
    </>
  );
}
