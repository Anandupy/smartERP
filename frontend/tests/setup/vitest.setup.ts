import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "@tests/mocks/server";

/**
 * jsdom implements neither `ResizeObserver` nor `Element.scrollIntoView`, both
 * of which Radix primitives (checkbox, tooltip, popover, select …) call during
 * layout effects. Stubbing them here keeps every component test free of the
 * same boilerplate; nothing under test asserts on observed sizes.
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

// Start the MSW server before the suite, reset between tests, close at the end.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
