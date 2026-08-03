import type { LucideIcon } from "@/assets/icons";

/**
 * Navigation contracts.
 *
 * The menu is **static** in this phase: it is declared in `constants.ts` and
 * read straight from there. The backend publishes a workspace navigation tree
 * (`GET /workspace/navigation`), and these types are shaped so that swapping the
 * source later is a change of one module — nothing renders a raw wire shape.
 */

/** A single destination in the sidebar. */
export interface NavItem {
  /** Stable identity, independent of the label or the URL. */
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Match child routes as active too. `false` for a section root that has its
   * own children, so `/app/settings/general` does not light up two entries.
   */
  exact?: boolean;
  /** Renders the entry inert, with a "Soon" marker. */
  comingSoon?: boolean;
  /** Announced by assistive tech alongside the label. */
  description?: string;
}

/** A labelled group of destinations, drawn with a divider above it. */
export interface NavSection {
  id: string;
  /** Group heading. `null` renders the items with no heading. */
  label: string | null;
  items: NavItem[];
}

/** One step in the trail from the app root to the current page. */
export interface Breadcrumb {
  label: string;
  /** Omitted on the final step, which is the current page and not a link. */
  href?: string;
}
