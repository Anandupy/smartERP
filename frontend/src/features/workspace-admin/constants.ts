import {
  Activity,
  Ban,
  Blocks,
  Book,
  Building2,
  CalendarClock,
  Clock,
  CreditCard,
  Database,
  EyeOff,
  FileText,
  GraduationCap,
  Home,
  Landmark,
  LayoutDashboard,
  MessageSquare,
  School,
  Server,
  Settings,
  Shield,
  Sparkles,
  TriangleAlert,
  Users,
  Wrench,
  type LucideIcon,
} from "@/assets/icons";

import type { MenuStatus } from "./types/menu.dto";
import type { WorkspaceScopeType } from "./types/configuration.dto";

/**
 * Module and menu `icon` fields are free text on the backend (`icon?: string`
 * on both `CreateModuleDto`/`CreateMenuDto`) — there is no documented
 * vocabulary. This is a presentation convenience only: it maps a handful of
 * names seen in the Postman examples (`home`, `users`, `book`, …) to a real
 * glyph, and falls back to a neutral icon for anything else rather than
 * rendering nothing.
 */
export const ICON_NAME_OPTIONS: Record<string, LucideIcon> = {
  home: Home,
  users: Users,
  "user-plus": Users,
  book: Book,
  "graduation-cap": GraduationCap,
  building: Building2,
  landmark: Landmark,
  school: School,
  wrench: Wrench,
  settings: Settings,
  shield: Shield,
  calendar: CalendarClock,
  "credit-card": CreditCard,
  "file-text": FileText,
  dashboard: LayoutDashboard,
  message: MessageSquare,
  server: Server,
  database: Database,
};

/** Neutral fallback for an icon name this module does not recognize. */
export const UNKNOWN_ICON: LucideIcon = Blocks;

export function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return UNKNOWN_ICON;
  return ICON_NAME_OPTIONS[name.trim().toLowerCase()] ?? UNKNOWN_ICON;
}

/**
 * Presentation for the six `MenuStatus` values.
 *
 * Only `ACTIVE` and `BETA` ever reach a real user's navigation tree
 * (`navigation.service.ts` filters to exactly those two) — the other four are
 * authoring states, and the admin UI is the only place they are ever visible.
 */
export const MENU_STATUS_PRESENTATION: Record<
  MenuStatus,
  { label: string; tone: "success" | "info" | "neutral" | "warning"; icon: LucideIcon; renders: boolean }
> = {
  ACTIVE: { label: "Active", tone: "success", icon: Sparkles, renders: true },
  BETA: { label: "Beta", tone: "info", icon: Sparkles, renders: true },
  COMING_SOON: { label: "Coming soon", tone: "neutral", icon: Clock, renders: false },
  DISABLED: { label: "Disabled", tone: "neutral", icon: Ban, renders: false },
  HIDDEN: { label: "Hidden", tone: "neutral", icon: EyeOff, renders: false },
  DEPRECATED: { label: "Deprecated", tone: "warning", icon: TriangleAlert, renders: false },
};

export const SCOPE_TYPE_LABELS: Record<WorkspaceScopeType, string> = {
  PRODUCT: "Product (global default)",
  ORGANIZATION: "Organization",
  BRANCH: "Branch",
  ROLE: "Role",
  USER: "User",
};

/** Presentation for the three independent health dimensions. */
export const HEALTH_DIMENSION_ICON = {
  live: Activity,
  ready: Server,
  health: Database,
} as const;

/** Conservative default — matches the interval the design brief recommends. */
export const HEALTH_POLL_INTERVAL_MS = 30_000;

/**
 * Presentation for every state `mapHealthStatus` can return, across all three
 * dimensions. Keys never collide across dimensions (`"live"` only ever comes
 * from the liveness mapping, `"ready"` only from readiness, etc.), so one
 * record safely covers `LiveState | ReadyState | HealthOverallState`.
 */
export const HEALTH_STATE_PRESENTATION: Record<
  string,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  live: { label: "Live", tone: "success" },
  down: { label: "Down", tone: "danger" },
  ready: { label: "Ready", tone: "success" },
  "not-ready": { label: "Not Ready", tone: "danger" },
  healthy: { label: "Healthy", tone: "success" },
  degraded: { label: "Degraded", tone: "danger" },
  unavailable: { label: "Unavailable", tone: "danger" },
  unknown: { label: "Unknown", tone: "neutral" },
};
