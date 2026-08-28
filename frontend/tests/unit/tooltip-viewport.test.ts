import {
  computePosition,
  flip,
  offset,
  shift,
  type ReferenceElement,
  type VirtualElement,
} from "@floating-ui/dom";
import { describe, expect, it } from "vitest";

import {
  SAFE_VIEWPORT_EDGE_MARGIN_PX,
  buildSafeAreaPadding,
  clampToSafeViewport,
  createSafeViewportClampMiddleware,
} from "@/core/guides/tooltip-viewport";

describe("clampToSafeViewport", () => {
  const viewport = { width: 1280, height: 720 };
  const safeArea = buildSafeAreaPadding(70);
  const tooltip = { width: 352, height: 391 };

  it("leaves a position already inside the safe area untouched", () => {
    const position = { x: 500, y: 200 };
    expect(clampToSafeViewport(position, tooltip, viewport, safeArea)).toEqual(
      position,
    );
  });

  it("clamps a position above the safe top (the reported Academic Unit bug: y: -344)", () => {
    const result = clampToSafeViewport({ x: 592, y: -344 }, tooltip, viewport, safeArea);
    expect(result.y).toBe(safeArea.top);
  });

  it("clamps a position below the safe bottom", () => {
    const result = clampToSafeViewport({ x: 592, y: 900 }, tooltip, viewport, safeArea);
    expect(result.y).toBe(viewport.height - safeArea.bottom - tooltip.height);
  });

  it("clamps a position left of the safe left edge", () => {
    const result = clampToSafeViewport({ x: -200, y: 200 }, tooltip, viewport, safeArea);
    expect(result.x).toBe(safeArea.left);
  });

  it("clamps a position right of the safe right edge", () => {
    const result = clampToSafeViewport({ x: 1200, y: 200 }, tooltip, viewport, safeArea);
    expect(result.x).toBe(viewport.width - safeArea.right - tooltip.width);
  });

  it("clamps a corner case (top-left simultaneously)", () => {
    const result = clampToSafeViewport({ x: -50, y: -50 }, tooltip, viewport, safeArea);
    expect(result).toEqual({ x: safeArea.left, y: safeArea.top });
  });

  it("clamps a corner case (bottom-right simultaneously)", () => {
    const result = clampToSafeViewport({ x: 2000, y: 2000 }, tooltip, viewport, safeArea);
    expect(result).toEqual({
      x: viewport.width - safeArea.right - tooltip.width,
      y: viewport.height - safeArea.bottom - tooltip.height,
    });
  });

  it("never produces a rect extending outside the safe viewport, for a matrix of positions/sizes/viewports", () => {
    const positions = [
      { x: -500, y: -500 },
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 5000, y: 5000 },
      { x: -9999, y: 300 },
      { x: 300, y: -9999 },
    ];
    const sizes = [
      { width: 352, height: 391 }, // the real GuideTooltip's typical size
      { width: 300, height: 100 },
      { width: 900, height: 700 }, // near-viewport-filling
    ];
    const viewports = [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ];

    for (const vp of viewports) {
      const area = buildSafeAreaPadding(70);
      for (const size of sizes) {
        for (const position of positions) {
          const result = clampToSafeViewport(position, size, vp, area);
          // A floating element wider/taller than the safe area pins to the
          // near edge (documented in clampToSafeViewport) rather than
          // satisfying the far bound — assert only what the function
          // actually promises: never *before* the near edge.
          expect(result.x).toBeGreaterThanOrEqual(area.left);
          expect(result.y).toBeGreaterThanOrEqual(area.top);
          if (size.width <= vp.width - area.left - area.right) {
            expect(result.x + size.width).toBeLessThanOrEqual(vp.width - area.right);
          }
          if (size.height <= vp.height - area.top - area.bottom) {
            expect(result.y + size.height).toBeLessThanOrEqual(vp.height - area.bottom);
          }
        }
      }
    }
  });

  it("pins to the near edge (never inverts min/max) when the element doesn't fit the safe area at all", () => {
    const tinyViewport = { width: 200, height: 150 };
    const bigTooltip = { width: 400, height: 400 };
    const result = clampToSafeViewport({ x: 0, y: 0 }, bigTooltip, tinyViewport, safeArea);
    expect(result.x).toBe(safeArea.left);
    expect(result.y).toBe(safeArea.top);
  });
});

describe("buildSafeAreaPadding", () => {
  it("uses the measured header clearance as the top padding, and a fixed margin elsewhere", () => {
    expect(buildSafeAreaPadding(84)).toEqual({
      top: 84,
      right: SAFE_VIEWPORT_EDGE_MARGIN_PX,
      bottom: SAFE_VIEWPORT_EDGE_MARGIN_PX,
      left: SAFE_VIEWPORT_EDGE_MARGIN_PX,
    });
  });
});

/**
 * Integration-of-pure-logic tests: run the *real* Floating UI pipeline
 * (`@floating-ui/dom`, the exact engine react-joyride bundles — see
 * `tooltip-viewport.ts`'s header comment) against virtual elements, with
 * our middleware wired in exactly the shape `guide-provider.tsx` wires it.
 * jsdom provides `window`/`document` but not real layout, so every rect is
 * an explicit mock — no real browser needed, but the algorithm under test
 * is the genuine one, not a reimplementation.
 */
describe("createSafeViewportClampMiddleware, wired through the real Floating UI pipeline", () => {
  function virtualTarget(rect: { x: number; y: number; width: number; height: number }): VirtualElement {
    return {
      getBoundingClientRect: () => ({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.y,
        left: rect.x,
        right: rect.x + rect.width,
        bottom: rect.y + rect.height,
      }),
    };
  }

  function makeFloatingElement(size: { width: number; height: number }): HTMLElement {
    const el = document.createElement("div");
    el.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      top: 0,
      left: 0,
      right: size.width,
      bottom: size.height,
      toJSON() {
        return this;
      },
    });
    // Floating UI's own `getDimensions` falls back to `offsetWidth`/
    // `offsetHeight` whenever they disagree with the (rounded)
    // `getBoundingClientRect` size — a real-browser safeguard against
    // subpixel/zoom rounding. jsdom's real `offsetWidth`/`offsetHeight` on a
    // plain, unlaid-out `<div>` are always 0, which would otherwise trigger
    // that fallback and silently zero out the floating element's size for
    // every alignment/clamp calculation.
    Object.defineProperty(el, "offsetWidth", { value: size.width, configurable: true });
    Object.defineProperty(el, "offsetHeight", { value: size.height, configurable: true });
    document.body.appendChild(el);
    return el;
  }

  function withViewport<T>(viewport: { width: number; height: number }, run: () => Promise<T>): Promise<T> {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    // Our own middleware reads `window.innerWidth`/`innerHeight` (matching a
    // real browser, where these track `document.documentElement.clientWidth`/
    // `clientHeight` modulo scrollbars). Floating UI's own boundary math does
    // not: `getViewportRect` in `@floating-ui/dom` reads
    // `document.documentElement.clientWidth`/`clientHeight` directly (see its
    // source) — jsdom defaults both to 0 regardless of `window.innerWidth`,
    // so both must be set for these tests to exercise the real algorithm
    // against the intended viewport rather than a degenerate 0×0 one.
    const html = document.documentElement;
    const originalClientWidth = Object.getOwnPropertyDescriptor(html, "clientWidth");
    const originalClientHeight = Object.getOwnPropertyDescriptor(html, "clientHeight");
    Object.defineProperty(window, "innerWidth", { value: viewport.width, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: viewport.height, configurable: true });
    Object.defineProperty(html, "clientWidth", { value: viewport.width, configurable: true });
    Object.defineProperty(html, "clientHeight", { value: viewport.height, configurable: true });
    return run().finally(() => {
      Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true });
      Object.defineProperty(window, "innerHeight", { value: originalHeight, configurable: true });
      if (originalClientWidth) Object.defineProperty(html, "clientWidth", originalClientWidth);
      if (originalClientHeight) Object.defineProperty(html, "clientHeight", originalClientHeight);
    });
  }

  async function computeClamped(
    reference: ReferenceElement,
    floating: HTMLElement,
    topClearance: number,
    initialPlacement: "top" | "bottom" | "left" | "right",
  ) {
    const position = await computePosition(reference, floating, {
      placement: initialPlacement,
      strategy: "absolute",
      middleware: [
        offset(8),
        // `crossAxis: false` matches react-joyride's own default (see
        // `getFlipMiddleware` in its bundled source) — calling `flip()`
        // directly here (rather than through react-joyride) means its raw
        // default (`crossAxis: true`) would otherwise apply instead,
        // letting it flip onto a perpendicular axis production never would.
        flip({ crossAxis: false, padding: buildSafeAreaPadding(topClearance) }),
        shift({ padding: buildSafeAreaPadding(topClearance) }),
        createSafeViewportClampMiddleware(topClearance),
      ],
    });
    // `computePosition`'s own return value carries no `rects` — only each
    // middleware's `fn(state)` sees `state.rects`. The floating element's
    // size is exactly what `makeFloatingElement` fixed it to, so read it
    // straight from the element rather than threading it through `state`.
    const floatingRect = floating.getBoundingClientRect();
    return { ...position, floatingSize: { width: floatingRect.width, height: floatingRect.height } };
  }

  it("reproduces and fixes the reported bug: a target far taller than the viewport no longer clips the tooltip above it", async () => {
    const viewport = { width: 1280, height: 720 };
    const topClearance = 73; // matches the live-measured header clearance in the repro
    // The Academic Unit create-submit step's real shape: `data-guide` on the
    // whole `<form>`, scrolled so its top sits just below the header, height
    // far exceeding the viewport.
    const target = virtualTarget({ x: 592, y: topClearance, width: 352, height: 2200 });
    const floating = makeFloatingElement({ width: 352, height: 391 });

    await withViewport(viewport, async () => {
      const { x, y, floatingSize } = await computeClamped(target, floating, topClearance, "bottom");
      expect(y).toBeGreaterThanOrEqual(topClearance);
      expect(y + floatingSize.height).toBeLessThanOrEqual(viewport.height);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + floatingSize.width).toBeLessThanOrEqual(viewport.width);
    });
  });

  it("keeps a normally-sized target's tooltip untouched by the clamp (no-op in the ordinary case)", async () => {
    const viewport = { width: 1280, height: 720 };
    const topClearance = 73;
    // A small button-sized target well inside the safe viewport — flip/shift
    // alone should already produce an in-bounds position.
    const target = virtualTarget({ x: 500, y: 300, width: 140, height: 36 });
    const floating = makeFloatingElement({ width: 352, height: 200 });

    await withViewport(viewport, async () => {
      const { y } = await computeClamped(target, floating, topClearance, "bottom");
      // Bottom placement of a target with plenty of room below needs no
      // help from the clamp — it should land right under the target.
      expect(y).toBeGreaterThan(300);
      expect(y).toBeLessThan(300 + 36 + 40);
    });
  });

  it("never renders above the measured header clearance, even when placement prefers 'top' near the very top of the page", async () => {
    const viewport = { width: 1280, height: 720 };
    const topClearance = 70;
    // A target scrolled to sit almost flush with the header — the exact
    // shape that forces flip to choose between two nearly-equally-bad
    // options when a step explicitly prefers "top".
    const target = virtualTarget({ x: 500, y: 75, width: 200, height: 30 });
    const floating = makeFloatingElement({ width: 352, height: 250 });

    await withViewport(viewport, async () => {
      const { y } = await computeClamped(target, floating, topClearance, "top");
      expect(y).toBeGreaterThanOrEqual(topClearance);
    });
  });

  it("stays inside a small phone viewport (320x568) for a bottom-of-page target", async () => {
    const viewport = { width: 320, height: 568 };
    const topClearance = 60;
    const target = virtualTarget({ x: 20, y: 520, width: 280, height: 40 });
    const floating = makeFloatingElement({ width: 296, height: 300 });

    await withViewport(viewport, async () => {
      const { x, y, floatingSize } = await computeClamped(target, floating, topClearance, "bottom");
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(topClearance);
      expect(x + floatingSize.width).toBeLessThanOrEqual(viewport.width);
      expect(y + floatingSize.height).toBeLessThanOrEqual(viewport.height);
    });
  });
});
