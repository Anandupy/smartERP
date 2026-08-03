import {
  History,
  Info,
  LifeBuoy,
  Palette,
  SlidersHorizontal,
  type LucideIcon,
} from "@/assets/icons";
import { ROUTES } from "@/constants";
import type { StatusBadgeTone } from "@/shared/components/data-display";

import type { SystemEnvironment } from "./types/system-settings.dto";

export interface SettingsSection {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /**
   * The section edits or reads data the backend has not documented. Its screen
   * ships, its writes do not.
   */
  backendPending?: boolean;
}

/**
 * The System Settings sections, declared once.
 *
 * Drives both the dashboard grid and the section sub-navigation, so the two
 * can never disagree about what exists — and adding a section is one entry.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = Object.freeze([
  {
    id: "general",
    label: "General",
    description:
      "Product identity, release tag and the environment this deployment runs as.",
    href: ROUTES.app.settings.general,
    icon: SlidersHorizontal,
  },
  {
    id: "branding",
    label: "Branding & Identity",
    description:
      "Logos, favicon and the visual assets shown across the institution's workspace.",
    href: ROUTES.app.settings.branding,
    icon: Palette,
    backendPending: true,
  },
  {
    id: "maintenance",
    label: "Maintenance & Support",
    description:
      "System-wide maintenance mode, the notice users see, and support channels.",
    href: ROUTES.app.settings.maintenance,
    icon: LifeBuoy,
  },
  {
    id: "system-information",
    label: "System Information",
    description:
      "Read-only view of the release, environment and configured support contacts.",
    href: ROUTES.app.settings.systemInformation,
    icon: Info,
  },
  {
    id: "history",
    label: "History & Audit",
    description:
      "Every change made to configuration, who made it, and when it happened.",
    href: ROUTES.app.settings.history,
    icon: History,
  },
]);

/** How each documented environment reads, and how it is coloured. */
export const ENVIRONMENT_PRESENTATION: Record<
  SystemEnvironment,
  { label: string; tone: StatusBadgeTone }
> = {
  DEV: { label: "Development", tone: "info" },
  STAGING: { label: "Staging", tone: "warning" },
  PROD: { label: "Production", tone: "danger" },
};

/** Options for the environment select, in documented order. */
export const ENVIRONMENT_OPTIONS = (
  Object.keys(ENVIRONMENT_PRESENTATION) as SystemEnvironment[]
).map((value) => ({
  value,
  label: ENVIRONMENT_PRESENTATION[value].label,
  hint: value,
}));
