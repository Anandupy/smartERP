// ============================================================
// Driver.js Tour Registry
//
// Architecture:
// - Tours are registered by ID
// - TourProvider reads from this registry
// - No hardcoded tours — all defined here
// - Tours are lazy: only loaded when triggered
// ============================================================

import type { TourDefinition } from '@/types/ui.types';

/**
 * Central tour registry.
 * All tours must be registered here before use.
 */
const tourRegistry = new Map<string, TourDefinition>();

/**
 * Register a tour definition.
 * Call this at module initialization (not inside components).
 */
export function registerTour(tour: TourDefinition): void {
  if (tourRegistry.has(tour.id)) {
    console.warn(`[Tours] Tour "${tour.id}" is already registered. Overwriting.`);
  }
  tourRegistry.set(tour.id, tour);
}

/**
 * Get a tour by ID.
 */
export function getTour(id: string): TourDefinition | undefined {
  return tourRegistry.get(id);
}

/**
 * Get all registered tours.
 */
export function getAllTours(): TourDefinition[] {
  return Array.from(tourRegistry.values());
}

/**
 * Get tours by type.
 */
export function getToursByType(type: TourDefinition['type']): TourDefinition[] {
  return Array.from(tourRegistry.values()).filter((t) => t.type === type);
}

/**
 * Get tours for a specific role.
 */
export function getToursForRole(role: string): TourDefinition[] {
  return Array.from(tourRegistry.values()).filter(
    (t) => !t.roles || t.roles.includes(role),
  );
}

// ── Built-in Tour Definitions ─────────────────────────────────

/**
 * App shell / onboarding tour — shown to first-time users.
 */
registerTour({
  id: 'app-shell-intro',
  type: 'page',
  title: 'Welcome to EduOS',
  autoStart: true,
  roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  steps: [
    {
      popover: {
        title: 'Welcome to EduOS',
        description:
          'This guided tour will help you get familiar with the ERP platform. You can restart it anytime from the Help menu.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="sidebar"]',
      popover: {
        title: 'Navigation',
        description:
          'The sidebar contains all main navigation links. You can collapse it for more workspace.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="context-bar"]',
      popover: {
        title: 'Workspace Context',
        description:
          'This bar shows your current Organization, Branch, Academic Year, and Program. All data is scoped to this context.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="search"]',
      popover: {
        title: 'Quick Search (CMD+K)',
        description:
          'Press CMD+K (or Ctrl+K) anywhere to search pages, records, and actions.',
        side: 'bottom',
        align: 'end',
      },
    },
  ],
});

/**
 * Setup wizard tour — guides new SUPER_ADMIN through initial setup.
 */
registerTour({
  id: 'setup-wizard',
  type: 'setup',
  title: 'Initial System Setup',
  autoStart: false,
  roles: ['SUPER_ADMIN'],
  steps: [
    {
      popover: {
        title: 'System Setup',
        description:
          'Let\'s set up your EduOS instance. We\'ll create your organization, first branch, and academic year.',
      },
    },
  ],
});
