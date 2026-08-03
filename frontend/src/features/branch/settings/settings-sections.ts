import {
  BellRing,
  CalendarClock,
  History,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "@/assets/icons";
import { ROUTES } from "@/constants";

/**
 * Branch Settings sections.
 *
 * **There is no Branch Settings API.** Every path in the Postman collection
 * containing "branch" is one of the seven endpoints on the branch entity
 * itself; none has `settings` in it. `backend/docs/modules/branch-settings.md`,
 * despite its filename, is a second document describing the branch *entity* —
 * not a settings resource.
 *
 * So four of these five sections have no endpoint, no DTO, no request body and
 * no validation. They ship as layout with the shared `Backend Pending`
 * components and no service methods at all: a fake `branchSettingsService`
 * would be a lie that later has to be unpicked, and the folder structure alone
 * is enough to make integration plug-and-play.
 *
 * **History is the exception** and is fully wired. Branch events are recorded
 * in the audit trail (`branch.created`, `branch.updated`, `branch.deleted`
 * under module `ORGANIZATION`), so it composes the audit explorer exactly as
 * the organization and system-settings histories do.
 */
export interface BranchSettingsSection {
  id: string;
  label: string;
  description: string;
  href: (branchId: string) => string;
  icon: LucideIcon;
  /** False for the one section that has a real contract behind it. */
  backendPending: boolean;
}

export const BRANCH_SETTINGS_SECTIONS: readonly BranchSettingsSection[] =
  Object.freeze([
    {
      id: "general",
      label: "General",
      description:
        "Profile, time zone, local branding and base branch metadata.",
      href: ROUTES.app.branches.settings.general,
      icon: SlidersHorizontal,
      backendPending: true,
    },
    {
      id: "academic",
      label: "Academic",
      description:
        "Curriculum structure, grading systems, semester cycles and attendance policy.",
      href: ROUTES.app.branches.settings.academic,
      icon: CalendarClock,
      backendPending: true,
    },
    {
      id: "communication",
      label: "Communication & Security",
      description:
        "Email and SMS gateways, notification protocols, SSO and encryption standards.",
      href: ROUTES.app.branches.settings.communication,
      icon: BellRing,
      backendPending: true,
    },
    {
      id: "integrations",
      label: "Integrations",
      description: "LMS sync, financial API keys and third-party webhooks.",
      href: ROUTES.app.branches.settings.integrations,
      icon: ShieldCheck,
      backendPending: true,
    },
    {
      id: "history",
      label: "History & Audit",
      description:
        "Every recorded change to this branch, who made it and when.",
      href: ROUTES.app.branches.settings.history,
      icon: History,
      backendPending: false,
    },
  ]);
