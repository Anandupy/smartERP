"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import {
  ACTIONS,
  EVENTS,
  Joyride,
  ORIGIN,
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

const GUIDE_TARGET_RING_CLASSES = [
  "ring-2",
  "ring-primary",
  "ring-offset-2",
  "ring-offset-background",
  "rounded-md",
];

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
 * A guide is additive: the real page remains usable through the spotlight,
 * and dismissing the tour always returns control to the page. Route-aware
 * steps can therefore span the real application's existing navigation.
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
          spotlightPadding: 8,
          spotlightRadius: 12,
          targetWaitTimeout: 6000,
          overlayColor: "var(--overlay-scrim)",
          blockTargetInteraction: false,
          overlayClickAction: "close",
          dismissKeyAction: "close",
          closeButtonAction: "close",
        }}
        onEvent={(data: EventData) => {
          if (data.type === EVENTS.STEP_AFTER && data.action === ACTIONS.NEXT) {
            guide.reportEvent();
            return;
          }

          if (
            data.type === EVENTS.STEP_AFTER &&
            (data.origin === ORIGIN.OVERLAY ||
              data.origin === ORIGIN.KEYBOARD ||
              data.origin === ORIGIN.BUTTON_CLOSE)
          ) {
            stop("skipped");
            return;
          }

          // Joyride can emit TOUR_END after the feature has already marked
          // the guide completed. Only turn an actually-running tour into a
          // skipped state; never overwrite a successful completion.
          if (
            data.type === EVENTS.TOUR_END &&
            useGuideStore.getState().status === "running"
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
