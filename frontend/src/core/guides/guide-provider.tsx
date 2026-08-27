"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

/** Breathing room beyond the sticky chrome's own height, so a scrolled-to
 * target doesn't sit flush against its bottom edge. */
const SCROLL_CLEARANCE_MARGIN_PX = 16;

/**
 * How far Joyride must scroll a target from the literal top of the viewport
 * to actually clear `AppLayout`'s sticky header.
 *
 * Joyride's own scroll math (`getScrollTo`) only ever asks "is the target's
 * raw coordinate inside `[0, viewportHeight]`?" — it has no notion of
 * permanently-docked chrome that keeps rendering over whatever content
 * scrolls underneath it. A target near the top of a page's content can
 * satisfy that raw check while still landing squarely behind the sticky
 * header (`position: sticky; top: 0`, `z-20`) — visible by coordinate,
 * invisible and unclickable in reality. Measuring the header's actual
 * rendered height (rather than hard-coding its current `h-14` class) means
 * this keeps working if the header's height ever changes.
 */
function useStickyChromeClearance(): number {
  const [clearance, setClearance] = useState(SCROLL_CLEARANCE_MARGIN_PX);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;

    const measure = () => {
      setClearance(header.getBoundingClientRect().height + SCROLL_CLEARANCE_MARGIN_PX);
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return clearance;
}

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
  const scrollOffset = useStickyChromeClearance();
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

  // Dev-only: names exactly which of the conditions a step needs is failing,
  // and — once the target should be showing — whether it actually resolves
  // to one real, unique, on-screen element. See docs/guides.md
  // "Diagnosing a wrong or missing target."
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!activeGuideId || !definition || !currentStep) return;
    const matches = currentStep
      ? document.querySelectorAll(currentStep.target)
      : [];
    const rect = matches[0]?.getBoundingClientRect();
    console.debug(
      "[core/guides]",
      JSON.stringify({
        guideId: activeGuideId,
        stepId: currentStep.id,
        stepIndex,
        status,
        pathname,
        stepRoute: currentStep.route,
        entityId,
        isOnCurrentStep,
        target: currentStep.target,
        matchCount: matches.length,
        rect: rect
          ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
          : null,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }),
    );
    if (matches.length > 1) {
      console.warn(
        `[core/guides] "${activeGuideId}":"${currentStep.id}" — target "${currentStep.target}" matches ${matches.length} elements on this page. A guide must never let Joyride pick one arbitrarily; give the intended element the only matching data-guide value.`,
      );
    }
  }, [
    activeGuideId,
    definition,
    currentStep,
    stepIndex,
    status,
    pathname,
    entityId,
    isOnCurrentStep,
  ]);

  // What Joyride shows is still strictly gated on `isOnCurrentStep` — this is
  // not optional. `stepMatchesPathname`'s entity-scoping check (§8) exists
  // precisely because a step's real target can legitimately exist in the DOM
  // on the *wrong* record's page (e.g. an unrelated existing academic year's
  // own "Lifecycle" link, which is a perfectly real element) — only the route
  // match, not "does querySelector find something," decides whether a step
  // is genuinely reachable.
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

  // `run`, in contrast, must never depend on `steps.length` (i.e. never on
  // `isOnCurrentStep`). Joyride is a controlled, continuous instance
  // (`stepIndex={0}` always, one step object at a time); a route change
  // always produces one render where the *previous* step's route no longer
  // matches the *new* page, one tick before the route-catch-up effect above
  // corrects `stepIndex` to the step that does. Toggling `run` off for that
  // instant does not pause the tour from Joyride's side — it ends it. Traced
  // directly through Joyride's own emitted events across a real route
  // transition: `tour:end` fired immediately after the corrected next step's
  // target was found, discarding the guide entirely. `run` only reflects
  // whether a guide is active at all; whether its tooltip currently has
  // anything to show is `steps.length` alone, which Joyride already handles
  // gracefully as "waiting" (up to `targetWaitTimeout`) — the same graceful
  // wait it already gives a target that hasn't mounted yet for any reason.
  const run = status === "running" && Boolean(definition);

  // Gated on `isOnCurrentStep`, not `run`: `run` alone no longer implies the
  // route (and entity) actually match (see above), and this ring must never
  // land on a same-selector element that merely exists on the wrong record's
  // page — the exact hazard §8's entity scoping exists to close.
  useEffect(() => {
    if (!run || !currentStep || !isOnCurrentStep) return;
    const element = document.querySelector<HTMLElement>(currentStep.target);
    if (!element) return;
    element.classList.add(...GUIDE_TARGET_RING_CLASSES);
    return () => {
      element.classList.remove(...GUIDE_TARGET_RING_CLASSES);
    };
  }, [run, currentStep, isOnCurrentStep]);

  return (
    <>
      {children}
      <Joyride
        // Every one of our logical steps is reported to Joyride as index 0 —
        // a single-slot controlled array whose *content* changes, never its
        // index (see `steps` above). Joyride's scroll trigger, though, only
        // runs on an internal INIT→READY lifecycle transition, and changing
        // a same-index step's content in place does not reliably force that
        // transition — confirmed by tracing Joyride's own emitted events:
        // the tooltip's title/content updates correctly, but `scroll:start`/
        // `scroll:end` only ever fired for the guide's true first step,
        // silently never again for any step after. Keying `<Joyride>` on the
        // logical step forces a full remount — a clean INIT lifecycle, and
        // therefore a real scroll check, every single time.
        //
        // The key must include `isOnCurrentStep`, not just the step id: a
        // step reaching its own route is itself a "new step becoming
        // visible" moment that needs the same fresh mount. Without this, a
        // step whose route requires waiting (a cross-route step arriving
        // *before* its destination page has navigated to it) mounts once
        // while `steps` is still empty, then merely receives an updated
        // `steps` prop once the route catches up — the same same-key,
        // content-only update Joyride's scroll trigger doesn't reliably
        // react to, just one level removed. Traced the same way: no
        // `tour:start`/`scroll:*` events at all for the step that arrived
        // this way, versus a full clean set for one that was already
        // reachable at mount.
        key={`${activeGuideId ?? "none"}:${currentStep?.id ?? "none"}:${isOnCurrentStep}`}
        run={run}
        steps={steps}
        stepIndex={0}
        continuous
        // Also required: `scrollToFirstStep` defaults to `false`, and since
        // every step looks like Joyride's own "first step" (index 0), it
        // would otherwise never scroll for any of them, remount or not.
        scrollToFirstStep
        tooltipComponent={GuideTooltip}
        options={{
          skipBeacon: true,
          showProgress: false,
          spotlightPadding: 6,
          spotlightRadius: 10,
          targetWaitTimeout: 6000,
          overlayColor: "var(--overlay-scrim)",
          // Without this, Joyride scrolls a target to just inside the raw
          // viewport (default 20px from the top) — comfortably behind
          // AppLayout's sticky header, not actually visible. See
          // `useStickyChromeClearance`.
          scrollOffset,
        }}
        onEvent={(data: EventData) => {
          if (process.env.NODE_ENV !== "production") {
            console.debug(
              "[core/guides] event",
              JSON.stringify({ type: data.type, action: data.action, index: data.index }),
            );
          }
          if (data.type === EVENTS.STEP_AFTER && data.action === ACTIONS.NEXT) {
            guide.reportEvent();
            return;
          }
          // ESC and the tooltip's own X both fire `closeButtonAction`/
          // `dismissKeyAction: "close"`, which Joyride resolves as
          // `controls.close()` — advancing its *internal* index by one
          // rather than a dedicated "dismissed" action. With our
          // always-exactly-one-step controlled array, that internal index
          // then exceeds the array's size, which — before the `key`-based
          // remount above existed — reliably also produced a `TOUR_END`
          // right behind it, so only that was ever handled. It no longer
          // reliably does once a step can arrive via a fresh mount (a
          // cross-route step reaching its own page): traced directly, a
          // `STEP_AFTER`/`close` fires with no `TOUR_END` behind it, and
          // without this, `stop()` is never called — the overlay stays
          // mounted (and pointer-events-blocking) indefinitely. Handling the
          // dismissal here, directly, does not depend on that emergent
          // "index overflow" side effect at all.
          if (data.type === EVENTS.STEP_AFTER && data.action === ACTIONS.CLOSE) {
            stop("skipped");
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
