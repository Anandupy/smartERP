import type { Middleware, MiddlewareState } from "@floating-ui/dom";

/** A rectangle's size, independent of position. */
export interface Size {
  width: number;
  height: number;
}

/** A point in some 2D coordinate space (viewport- or document-relative,
 * depending on the caller). */
export interface Point {
  x: number;
  y: number;
}

/** Space reserved on each side of the window that a tooltip must never
 * render into — app chrome (the sticky header) on top, a small breathing
 * margin on every other side. */
export interface SafeAreaPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Breathing room from the raw window edge on every side but the top, which
 * is instead driven by the measured sticky-header height (see
 * `buildSafeAreaPadding`). */
export const SAFE_VIEWPORT_EDGE_MARGIN_PX = 12;

/**
 * Clamps a floating element's viewport-relative position so it always
 * renders fully inside the safe viewport rectangle — window bounds minus
 * whatever app chrome occupies real screen space.
 *
 * Pure and DOM-free: plain rects and sizes in, a plain point out. This is
 * the guide platform's one positioning invariant, and the thing every other
 * function in this module exists to satisfy — see
 * `createSafeViewportClampMiddleware` for how it's actually applied, and
 * `tests/unit/tooltip-viewport.test.ts` for the property-style coverage
 * this shape enables (no browser needed to assert it).
 */
export function clampToSafeViewport(
  position: Point,
  floatingSize: Size,
  viewport: Size,
  safeArea: SafeAreaPadding,
): Point {
  const minX = safeArea.left;
  const minY = safeArea.top;
  // `Math.max(min, …)` guards a floating element wider/taller than the
  // remaining safe area (long content, a very small viewport): it pins to
  // the near edge rather than producing a `max < min` range that would
  // invert the later clamp.
  const maxX = Math.max(minX, viewport.width - safeArea.right - floatingSize.width);
  const maxY = Math.max(minY, viewport.height - safeArea.bottom - floatingSize.height);
  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  };
}

/**
 * The safe-area padding Floating UI's own `flip`/`shift` middleware use to
 * make their *first* placement decision — so the preferred placement
 * already respects app chrome, not just the clamp backstop below.
 * `topClearance` is the same dynamically-measured sticky-header clearance
 * `guide-provider.tsx` already computes for scrolling
 * (`useStickyChromeClearance`) — one ResizeObserver-backed measurement,
 * two consumers.
 */
export function buildSafeAreaPadding(topClearance: number): SafeAreaPadding {
  return {
    top: topClearance,
    right: SAFE_VIEWPORT_EDGE_MARGIN_PX,
    bottom: SAFE_VIEWPORT_EDGE_MARGIN_PX,
    left: SAFE_VIEWPORT_EDGE_MARGIN_PX,
  };
}

/**
 * The hard positioning backstop — docs/guides.md "Tooltip Positioning
 * Contract". Appended as the *last* Floating UI middleware, after
 * Joyride's own `offset`/`flip`/`shift`/`arrow` have all already run.
 *
 * Why `buildSafeAreaPadding` alone isn't sufficient: `flip`/`shift` make
 * their placement decision from the *target's* geometry, and a step's
 * target can legitimately be much taller than the viewport — the Academic
 * Unit and Program create-submit steps target the whole `<form>` rather
 * than the submit button, deliberately, so Joyride's dimmed overlay never
 * blocks a required field elsewhere in the form (see "Guide target
 * reliability"). Against a target that tall, `flip`'s fallback picks
 * whichever placement overflows *least* — which can still overflow.
 * Confirmed live: before this fix, the Academic Unit create-submit
 * tooltip's `top` rendered ~340px above the viewport (`y: -344` at
 * 1280×720), matching the reported screenshot exactly.
 *
 * In the ordinary case — a normally-sized target, nearly every step —
 * `flip`/`shift` already land inside the safe viewport by the time this
 * runs, so it's a no-op and the arrow stays exactly where Floating UI's own
 * `arrow` middleware put it. It only moves the tooltip in the pathological
 * case `flip`/`shift` couldn't fully solve, where the alternative is
 * breaking the hard acceptance rule instead of trading a moment of
 * imprecise arrow alignment for it.
 */
export function createSafeViewportClampMiddleware(topClearance: number): Middleware {
  return {
    name: "campusflow-safe-viewport-clamp",
    fn(state: MiddlewareState) {
      const { x, y, rects, strategy } = state;
      // `absolute`-strategy coordinates are document-relative, not
      // viewport-relative — Joyride only switches to `fixed` for an
      // already-fixed-position target. Round-tripping through the current
      // scroll position keeps this correct under either strategy.
      const scrollX = strategy === "fixed" ? 0 : window.scrollX;
      const scrollY = strategy === "fixed" ? 0 : window.scrollY;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const clamped = clampToSafeViewport(
        { x: x - scrollX, y: y - scrollY },
        rects.floating,
        viewport,
        buildSafeAreaPadding(topClearance),
      );
      const nextX = clamped.x + scrollX;
      const nextY = clamped.y + scrollY;
      if (nextX === x && nextY === y) return {};
      return { x: nextX, y: nextY };
    },
  };
}
