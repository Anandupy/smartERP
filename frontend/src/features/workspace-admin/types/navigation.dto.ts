/**
 * Wire shape for `GET /workspace/navigation`.
 *
 * Transcribed from `navigation-response.dto.ts` and `navigation-tree.builder.ts`
 * on the backend. This is the **runtime, permission-filtered tree for the
 * calling user** — not a management listing. `permissions`, `permissionMode`
 * and `isSystem` are stripped server-side before this shape is returned, so
 * they are not present here even though they exist on `MenuDto`.
 *
 * Used in this module only as a small "reach" indicator (how much of the
 * authored hierarchy is currently reaching a real navigation tree) — never as
 * the source of admin listings, and never to decide what an admin screen shows.
 */
import type { MenuStatus } from "./menu.dto";

export interface NavigationTreeNodeDto {
  id: string;
  code: string;
  moduleId: string;
  parentId: string | null;
  route: string;
  componentIdentifier: string | null;
  displayName: string;
  icon: string | null;
  tooltip: string | null;
  description: string | null;
  displayOrder: number;
  badge: string | null;
  searchKeywords: string[];
  helpUrl: string | null;
  documentationUrl: string | null;
  status: MenuStatus;
  children: NavigationTreeNodeDto[];
}

export interface NavigationTreeDto {
  tree: NavigationTreeNodeDto[];
  /** Nodes at every depth, not just roots. */
  totalVisibleMenus: number;
  /** Deepest nesting level reached. */
  menuTreeDepth: number;
}
