/**
 * Core platform layer barrel.
 *
 * The core layer owns cross-cutting infrastructure — API transport, auth
 * contracts, query configuration, and theming — with no business logic. Feature
 * modules build on top of it.
 */
export * as coreApi from "./api";
export * as coreAuth from "./auth";
export * as coreQuery from "./query";
export * as coreTheme from "./theme";
