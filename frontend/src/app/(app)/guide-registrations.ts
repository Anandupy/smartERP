"use client";

import { registerGuide } from "@/core/guides";
import { academicYearsGuide } from "@/features/academic-year";
import { branchesGuide } from "@/features/branch";
import { organizationsGuide } from "@/features/organization";

/**
 * Registers every page guide the authenticated app ships.
 *
 * `core` never imports a feature, so registration happens here instead — the
 * one place cross-feature composition already happens for this route group
 * (see `layout.tsx`). Adding a future module's guide is one more import and
 * one more call; nothing else in the app layer changes.
 *
 * This must be a client module rendered as JSX, not a bare side-effect import
 * from the (server) layout: `core/guides`' registry is a plain module-level
 * `Map`, and Next's RSC/client split gives the server bundle and the browser
 * bundle their own separate instance of every module. A bare `import
 * "./guide-registrations"` from `layout.tsx` only ever reaches the *server's*
 * copy of the registry — `useGuide`/`GuideHelpTrigger` run in the browser and
 * read the *client's* copy, which would stay permanently empty. Rendering
 * `<GuideRegistrations />` (this module's export) forces Next to ship this
 * chunk to, and execute it in, the browser too. The registration call itself
 * still runs exactly once, at module evaluation — not on every render — and
 * `registerGuide` already ignores a duplicate id if this module is ever
 * evaluated more than once (e.g. Fast Refresh).
 */
registerGuide(organizationsGuide);
registerGuide(branchesGuide);
registerGuide(academicYearsGuide);

export function GuideRegistrations() {
  return null;
}
