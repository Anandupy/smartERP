import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "@tests/mocks/server";

/**
 * jsdom omits several layout APIs that headless UI libraries call from layout
 * effects and timers: `ResizeObserver` and `scrollIntoView` (Radix checkbox,
 * tooltip, popover, select) and `elementFromPoint` (`input-otp`'s caret
 * tracking). Stubbing them here keeps every component test free of the same
 * boilerplate; nothing under test asserts on measured geometry.
 */
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

/**
 * jsdom implements no `matchMedia`, which every responsive hook in the platform
 * is built on (`useMediaQuery` → `useBreakpoint` / `useIsMobile`), and which the
 * sidebar primitive uses to choose between a desktop rail and a mobile drawer.
 *
 * The stub reports **no match**, so component tests render the desktop layout.
 * That is the deliberate default: it is the layout with the most structure to
 * assert against, and a test that needs the mobile branch can override
 * `window.matchMedia` for its own case rather than every other test having to
 * opt out of one.
 */
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/**
 * jsdom implements no Pointer Capture API. Radix's Select calls it while
 * deciding whether a pointer-down became a drag, so without these the trigger
 * throws before the listbox ever opens.
 */
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// Start the MSW server before the suite, reset between tests, close at the end.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  // Web Storage is shared across a file's tests, so a spec that persists a
  // session would otherwise leak it into the next one.
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterAll(() => server.close());
