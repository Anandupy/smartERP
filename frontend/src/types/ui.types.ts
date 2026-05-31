// ============================================================
// UI Types — Component props, state shapes, and UI contracts
// ============================================================

import type { LucideIcon } from 'lucide-react';

// ── Navigation ────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
  badge?: string | number;
  children?: NavItem[];
  isExternal?: boolean;
  isDisabled?: boolean;
  /** For future modules not yet implemented */
  isComingSoon?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

// ── Breadcrumb ────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// ── Context Bar ───────────────────────────────────────────────

export interface ContextSelection {
  id: string;
  name: string;
  code?: string;
}

// ── Data Table ────────────────────────────────────────────────

export interface TableFilter {
  id: string;
  label: string;
  value: string;
}

export interface BulkAction {
  label: string;
  icon?: LucideIcon;
  variant?: 'default' | 'destructive';
  action: (selectedIds: string[]) => void | Promise<void>;
}

// ── Theme ────────────────────────────────────────────────────

export type ColorMode = 'light' | 'dark' | 'system';
export type DataDensity = 'comfortable' | 'compact' | 'erp-dense';
export type SidebarLayout = 'fixed' | 'static' | 'mini';
export type HeaderLayout = 'fixed' | 'static';
export type ContentLayout = 'fluid' | 'boxed';

export interface OrgTheme {
  primaryColor: string;
  primaryForeground: string;
  secondaryColor: string;
  secondaryForeground: string;
  accentColor: string;
  accentForeground: string;
  fontFamily: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  density: DataDensity;
  sidebarLayout: SidebarLayout;
  headerLayout: HeaderLayout;
  contentLayout: ContentLayout;
  logoUrl?: string;
  faviconUrl?: string;
}

// ── Drawer / Dialog ───────────────────────────────────────────

export interface DrawerState {
  isOpen: boolean;
  recordId: string | null;
  mode: 'view' | 'edit' | 'create';
}

// ── Form Engine ───────────────────────────────────────────────

export interface FormFieldOption {
  label: string;
  value: string;
  disabled?: boolean;
  description?: string;
}

// ── Tour ─────────────────────────────────────────────────────

export type TourType = 'page' | 'module' | 'setup';

export interface TourStep {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
  };
}

export interface TourDefinition {
  id: string;
  type: TourType;
  title: string;
  steps: TourStep[];
  /** Only show on first visit */
  autoStart?: boolean;
  /** Roles that should see this tour */
  roles?: string[];
}

// ── Plugin ────────────────────────────────────────────────────

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  routes?: PluginRoute[];
  navItems?: Partial<NavItem>[];
}

export interface PluginRoute {
  path: string;
  component: string;
}

// ── Status ───────────────────────────────────────────────────

export type StatusVariant =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'suspended'
  | 'locked'
  | 'current'
  | 'archive'
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled';
