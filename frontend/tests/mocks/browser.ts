import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

/**
 * MSW worker for browser environments (Storybook, browser-mode tests, or local
 * mocking during development). Start it from an entry point when needed.
 */
export const worker = setupWorker(...handlers);
