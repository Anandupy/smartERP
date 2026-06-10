/**
 * EduOS UI — Active version barrel export.
 *
 * UI versioning strategy:
 *   - src/ui/v1/  — current UI implementation
 *   - src/ui/v2/  — future UI (different layout/workflows, same APIs)
 *   - src/ui/shared/ — cross-version utilities
 *
 * To switch UI versions: change the import below.
 * Routes (/dashboard, /admissions, etc.) never change.
 * The UI version switch is internal architecture only.
 *
 * ACTIVE_UI_VERSION drives which implementation is served.
 */

export const ACTIVE_UI_VERSION = 'v1' as const;
export type UIVersion = 'v1'; // | 'v2' when v2 is added

export * from './v1';
