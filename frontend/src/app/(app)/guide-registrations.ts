import { registerGuide } from "@/core/guides";
import { academicYearsGuide } from "@/features/academic-year";

/**
 * Registers every page guide the authenticated app ships.
 *
 * `core` never imports a feature, so registration happens here instead — the
 * one place cross-feature composition already happens for this route group
 * (see `layout.tsx`). Adding a future module's guide is one more import and
 * one more call; nothing else in the app layer changes.
 */
registerGuide(academicYearsGuide);
