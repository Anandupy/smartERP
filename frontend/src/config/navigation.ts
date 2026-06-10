// ============================================================
// Navigation Configuration — Config-driven sidebar navigation
//
// Architecture:
//   NAV_SECTIONS: NavSection[]   — core application sections
//   getNavSections(role)         — returns filtered + plugin-merged sections
//   NavSection.items             — filtered by role at render time
//
// Extension points:
//   registerPlugin({ navSections })  — inject sidebar items from plugins
//   NavItem.featureFlag              — gate behind feature flags (future)
//   NavItem.pluginId                 — mark as plugin-contributed
// ============================================================

import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Network,
  Building2,
  GitBranch,
  Users,
  UserPlus,
  Users2,
  CalendarCheck,
  Banknote,
  BarChart3,
  Settings2,
  Palette,
  ClipboardList,
  Puzzle,
  GraduationCap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@/types/domain.types';
import { getPluginNavSections } from '@/lib/plugins/registry';

// ── Types ─────────────────────────────────────────────────────

export interface NavItem {
  /** Unique identifier for this nav item */
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Which roles can see this item. Empty array = all roles. */
  roles: UserRole[];
  badge?: string | number;
  children?: NavItem[];
  isComingSoon?: boolean;
  isDisabled?: boolean;
  /** Future: gate behind a feature flag key */
  featureFlag?: string;
  /** If set, this item was injected by a plugin */
  pluginId?: string;
}

export interface NavSection {
  /** Unique section identifier */
  id: string;
  /** Optional section label displayed above items (e.g. "ACADEMICS") */
  label?: string;
  /** Items in this section */
  items: NavItem[];
  /** Plugin-contributed sections carry the plugin ID */
  pluginId?: string;
}

// ── Role Helpers ──────────────────────────────────────────────

const ALL_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'BRANCH_ADMIN',
  'STAFF',
  'STUDENT',
  'PARENT',
];

// ── Core Navigation Sections ──────────────────────────────────

export const NAV_SECTIONS: NavSection[] = [
  // ── Dashboard ────────────────────────────────────────────
  {
    id: 'main',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: ALL_ROLES,
      },
    ],
  },

  // ── Academics ────────────────────────────────────────────
  {
    id: 'academics',
    label: 'ACADEMICS',
    items: [
      {
        id: 'academic-years',
        label: 'Academic Years',
        href: '/settings/academic',
        icon: CalendarDays,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
      },
      {
        id: 'programs',
        label: 'Programs',
        href: '/academic/programs',
        icon: BookOpen,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
      },
      {
        id: 'academic-units',
        label: 'Academic Units',
        href: '/academic',
        icon: Network,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
      },
    ],
  },

  // ── Administration ───────────────────────────────────────
  {
    id: 'administration',
    label: 'ADMINISTRATION',
    items: [
      {
        id: 'organizations',
        label: 'Organizations',
        href: '/administration/organizations',
        icon: Building2,
        roles: ['SUPER_ADMIN'],
      },
      {
        id: 'branches',
        label: 'Branches',
        href: '/settings/branches',
        icon: GitBranch,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN'],
      },
      {
        id: 'users',
        label: 'Users',
        href: '/administration/users',
        icon: Users,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN'],
      },
    ],
  },

  // ── Operations ──────────────────────────────────────────
  {
    id: 'operations',
    items: [
      {
        id: 'admissions',
        label: 'Admissions',
        href: '/admissions',
        icon: UserPlus,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
      },
      {
        id: 'students',
        label: 'Students',
        href: '/students',
        icon: Users2,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
        isComingSoon: true,
      },
      {
        id: 'attendance',
        label: 'Attendance',
        href: '/attendance',
        icon: CalendarCheck,
        roles: ALL_ROLES,
        isComingSoon: true,
      },
      {
        id: 'finance',
        label: 'Finance',
        href: '/finance',
        icon: Banknote,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
        isComingSoon: true,
      },
      {
        id: 'reports',
        label: 'Reports',
        href: '/reports',
        icon: BarChart3,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
        isComingSoon: true,
      },
    ],
  },

  // ── Settings ────────────────────────────────────────────
  {
    id: 'settings',
    label: 'SETTINGS',
    items: [
      {
        id: 'system-settings',
        label: 'System Settings',
        href: '/settings/general',
        icon: Settings2,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN'],
      },
      {
        id: 'theme-studio',
        label: 'Theme Studio',
        href: '/settings/theme',
        icon: Palette,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN'],
      },
      {
        id: 'audit-logs',
        label: 'Audit Logs',
        href: '/administration/audit',
        icon: ClipboardList,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN'],
      },
    ],
  },

  // ── Plugins ─────────────────────────────────────────────
  {
    id: 'plugins',
    items: [
      {
        id: 'plugins',
        label: 'Plugins',
        href: '/plugins',
        icon: Puzzle,
        roles: ALL_ROLES,
        isComingSoon: true,
      },
    ],
  },
];

// ── Runtime Navigation Builder ───────────────────────────────

/**
 * Returns navigation sections filtered by the user's role,
 * merged with any plugin-contributed sections.
 *
 * This is the primary function consumed by the Sidebar component.
 */
export function getNavSections(role: UserRole | null): NavSection[] {
  const base = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      // Empty roles array = visible to all
      if (!item.roles || item.roles.length === 0) return true;
      if (!role) return false;
      return item.roles.includes(role);
    }),
  })).filter((section) => section.items.length > 0);

  // Cast plugin sections — they're structurally compatible with NavSection
  const pluginSections = (getPluginNavSections(role ?? undefined) as unknown as NavSection[])
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.roles || item.roles.length === 0) return true;
        if (!role) return false;
        return item.roles.includes(role);
      }),
    })).filter((s) => s.items.length > 0);

  return [...base, ...pluginSections];
}

// ── Legacy Compatibility ──────────────────────────────────────
// Keep NAV_ITEMS for any legacy code still referencing it

export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

// Export icon for use in sidebar logo
export { GraduationCap as EduOSLogoIcon };
