import {
  Activity,
  Blocks,
  Building2,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  Landmark,
  Layers,
  LayoutDashboard,
  ListTree,
  MessageSquare,
  School,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Users,
  Wrench,
} from "@/assets/icons";
import { ROUTES } from "@/constants";

import type { NavSection } from "./types";

/**
 * The sidebar menu, declared once.
 *
 * Static by design for this phase — the backend's navigation tree is not wired
 * yet, and inventing a shape for it would be worse than a list that is honest
 * about being fixed. Everything already shipped sits in the first section;
 * the second advertises what is coming without pretending it is reachable.
 */
export const NAV_SECTIONS: readonly NavSection[] = Object.freeze([
  {
    id: "platform",
    label: "Administration",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: ROUTES.app.root,
        icon: LayoutDashboard,
        exact: true,
        description: "Workspace overview",
      },
      {
        id: "organizations",
        label: "Organizations",
        href: ROUTES.app.organizations.root,
        icon: Building2,
        description: "Tenants and subscriptions",
      },
      {
        id: "branches",
        label: "Branches",
        href: ROUTES.app.branches.root,
        icon: School,
        description: "Campuses and settings",
      },
      {
        id: "academic-years",
        label: "Academic Years",
        href: ROUTES.app.academicYears.root,
        icon: CalendarRange,
        description: "Timeframes and calendar",
      },
      {
        id: "programs",
        label: "Programs",
        href: ROUTES.app.programs.root,
        icon: Blocks,
        description: "Academic classification",
      },
      {
        id: "academic-units",
        label: "Academic Units",
        href: ROUTES.app.academicUnits.root,
        icon: Layers,
        description: "Classes, divisions and batches",
      },
      {
        id: "system-settings",
        label: "System Settings",
        href: ROUTES.app.settings.root,
        icon: Settings,
        description: "Global configuration",
      },
      {
        id: "maintenance",
        label: "Maintenance",
        href: ROUTES.app.maintenance.root,
        icon: Wrench,
        description: "Availability rules",
      },
      {
        id: "audit-logs",
        label: "Audit Logs",
        href: ROUTES.app.audit.root,
        icon: ScrollText,
        description: "Activity trail",
      },
      {
        id: "communication",
        label: "Communication",
        href: ROUTES.app.communication.root,
        icon: MessageSquare,
        description: "Templates, delivery logs and settings",
      },
      {
        id: "workspace-admin-modules",
        label: "Navigation Modules",
        href: ROUTES.app.workspaceAdmin.modules.root,
        icon: Blocks,
        description: "Top-level ERP capabilities",
      },
      {
        id: "workspace-admin-menus",
        label: "Menu Details",
        href: ROUTES.app.workspaceAdmin.menus.root,
        icon: ListTree,
        description: "The menu hierarchy inside each module",
      },
      {
        id: "workspace-admin-configuration",
        label: "Workspace Configuration",
        href: ROUTES.app.workspaceAdmin.configuration,
        icon: SlidersHorizontal,
        description: "Layered navigation and client preferences",
      },
      {
        id: "workspace-admin-health",
        label: "System Health",
        href: ROUTES.app.workspaceAdmin.health,
        icon: Activity,
        description: "Process, traffic and dependency probes",
      },
    ],
  },
  {
    id: "modules",
    label: "More Modules",
    items: [
      {
        id: "admissions",
        label: "Admissions",
        href: ROUTES.app.admissionMasters.root,
        icon: GraduationCap,
        description: "Reference data for admission and applicant workflows",
      },
      {
        id: "students",
        label: "Students",
        href: ROUTES.app.root,
        icon: Users,
        comingSoon: true,
      },
      {
        id: "academics",
        label: "Academics",
        href: ROUTES.app.root,
        icon: CalendarDays,
        comingSoon: true,
      },
      {
        id: "finance",
        label: "Finance",
        href: ROUTES.app.root,
        icon: Landmark,
        comingSoon: true,
      },
      {
        id: "more",
        label: "HR, Library, Transport",
        href: ROUTES.app.root,
        icon: Blocks,
        comingSoon: true,
      },
    ],
  },
]);

/**
 * Breadcrumb labels for paths that carry one.
 *
 * Keyed by full path so a trail never has to be assembled from guesses: a
 * segment like `system-information` would humanize to "System Information" by
 * luck, while `new` would become "New" instead of "Create rule". Unlisted
 * paths fall back to title case, which is correct for record ids and harmless
 * for anything else.
 */
export const BREADCRUMB_LABELS: Readonly<Record<string, string>> =
  Object.freeze({
    [ROUTES.app.root]: "Dashboard",
    [ROUTES.app.settings.root]: "System Settings",
    [ROUTES.app.settings.general]: "General",
    [ROUTES.app.settings.branding]: "Branding & Identity",
    [ROUTES.app.settings.maintenance]: "Maintenance & Support",
    [ROUTES.app.settings.systemInformation]: "System Information",
    [ROUTES.app.settings.history]: "History & Audit",
    [ROUTES.app.maintenance.root]: "Maintenance",
    [ROUTES.app.maintenance.create]: "New rule",
    [ROUTES.app.audit.root]: "Audit Logs",
    [ROUTES.app.organizations.root]: "Organizations",
    [ROUTES.app.organizations.directory]: "Directory",
    [ROUTES.app.organizations.create]: "New organization",
    [ROUTES.app.branches.root]: "Branches",
    [ROUTES.app.branches.directory]: "Directory",
    [ROUTES.app.branches.create]: "New branch",
    [ROUTES.app.academicYears.root]: "Academic Years",
    [ROUTES.app.academicYears.directory]: "Directory",
    [ROUTES.app.academicYears.calendar]: "Calendar",
    [ROUTES.app.academicYears.create]: "New academic year",
    [ROUTES.app.programs.root]: "Programs",
    [ROUTES.app.programs.directory]: "Directory",
    [ROUTES.app.programs.tree]: "Hierarchy",
    [ROUTES.app.programs.create]: "New program",
    [ROUTES.app.academicUnits.root]: "Academic Units",
    [ROUTES.app.academicUnits.directory]: "Directory",
    [ROUTES.app.academicUnits.tree]: "Hierarchy",
    [ROUTES.app.academicUnits.create]: "New academic unit",
    [ROUTES.app.communication.root]: "Communication",
    [ROUTES.app.communication.templates.root]: "Templates",
    [ROUTES.app.communication.templates.create]: "New template",
    [ROUTES.app.communication.deliveryLogs]: "Delivery Logs",
    [ROUTES.app.communication.analytics]: "Analytics",
    [ROUTES.app.communication.settings]: "Settings",
    [ROUTES.app.communication.sendNotification]: "Send Notification",
    [ROUTES.app.workspaceAdmin.modules.root]: "Navigation Modules",
    [ROUTES.app.workspaceAdmin.modules.create]: "New module",
    [ROUTES.app.workspaceAdmin.menus.root]: "Menu Details",
    [ROUTES.app.workspaceAdmin.configuration]: "Workspace Configuration",
    [ROUTES.app.workspaceAdmin.health]: "System Health",
  });

/** Placeholder copy for the header affordances that are not wired yet. */
export const SEARCH_PLACEHOLDER = "Search settings, rules, logs…";
