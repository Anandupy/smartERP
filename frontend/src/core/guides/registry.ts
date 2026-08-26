import type { GuideDefinition } from "./types";

/**
 * The guide registry.
 *
 * A plain module-level map, not reactive state: a guide's definition is
 * static configuration decided at build time, not something that changes
 * while the app runs. Feature modules author `GuideDefinition`s; the app
 * layer registers them once (see `src/app/(app)/guide-registrations.ts`) —
 * `core` never imports a feature, so registration always happens the other
 * way around.
 */
const registry = new Map<string, GuideDefinition>();

/**
 * Registers a guide. Safe to call more than once for the same id (e.g. a
 * Next.js Fast Refresh re-evaluating the registrations module) — the
 * duplicate is ignored rather than thrown, so a guide can never take down the
 * app it is meant to help explain.
 */
export function registerGuide(definition: GuideDefinition): void {
  if (registry.has(definition.id)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[core/guides] A guide with id "${definition.id}" is already registered — ignoring the duplicate registration.`,
      );
    }
    return;
  }
  registry.set(definition.id, definition);
}

export function getGuide(id: string): GuideDefinition | undefined {
  return registry.get(id);
}

export function getAllGuides(): GuideDefinition[] {
  return Array.from(registry.values());
}

/** Guides that may be entered (e.g. via the Help drawer) from this route. */
export function getGuidesForRoute(pathname: string): GuideDefinition[] {
  return getAllGuides().filter((guide) =>
    guide.entryRoutes.includes(pathname),
  );
}

/** Test-only: clears the registry so guide-registry specs don't leak state
 * into each other. Never called from application code. */
export function __resetGuideRegistryForTests(): void {
  registry.clear();
}
