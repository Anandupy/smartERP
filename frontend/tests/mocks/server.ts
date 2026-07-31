import { setupServer } from "msw/node";

import { handlers } from "./handlers";

/** MSW server for Node-based (jsdom) tests. */
export const server = setupServer(...handlers);
