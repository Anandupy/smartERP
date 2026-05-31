// ============================================================
// Navigation Configuration — Sidebar nav item definitions
// ============================================================

import {
  LayoutDashboard,
  UserPlus,
  BookOpen,
  Users,
  CalendarCheck,
  Banknote,
  Users2,
  BarChart3,
  Building2,
  Settings,
  Puzzle,
  ClipboardList,
} from 'lucide-react';
import type { NavItem } from '@/types/ui.types';

const ALL_ROLES = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'BRANCH_ADMIN',
  'STAFF',
  'STUDENT',
  'PARENT',
];

/**
 * Main navigation items.
 * Items are filtered at render time based on user role.
 * Future modules are marked with isComingSoon: true.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ALL_ROLES,
  },
  {
    label: 'Admissions',
    href: '/admissions',
    icon: UserPlus,
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
  },
  {
    label: 'Academic',
    href: '/academic',
    icon: BookOpen,
    roles: ALL_ROLES,
    children: [
      {
        label: 'Units Explorer',
        href: '/academic',
        icon: BookOpen,
        roles: ALL_ROLES,
      },
      {
        label: 'Programs',
        href: '/academic/programs',
        icon: BookOpen,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
      },
      {
        label: 'Hierarchy',
        href: '/academic/hierarchy',
        icon: BookOpen,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
      },
    ],
  },
  {
    label: 'Students',
    href: '/students',
    icon: Users,
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
    isComingSoon: true,
  },
  {
    label: 'Attendance',
    href: '/attendance',
    icon: CalendarCheck,
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
    isComingSoon: true,
  },
  {
    label: 'Finance',
    href: '/finance',
    icon: Banknote,
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
    isComingSoon: true,
  },
  {
    label: 'HR',
    href: '/hr',
    icon: Users2,
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
    isComingSoon: true,
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: BarChart3,
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
    isComingSoon: true,
  },
  {
    label: 'Administration',
    href: '/administration',
    icon: Building2,
    roles: ['SUPER_ADMIN', 'ORG_ADMIN'],
    children: [
      {
        label: 'Organizations',
        href: '/administration/organizations',
        icon: Building2,
        roles: ['SUPER_ADMIN'],
      },
      {
        label: 'Users',
        href: '/administration/users',
        icon: Users,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN'],
      },
      {
        label: 'Audit Logs',
        href: '/administration/audit',
        icon: ClipboardList,
        roles: ['SUPER_ADMIN', 'ORG_ADMIN'],
      },
    ],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  },
  {
    label: 'Plugins',
    href: '/plugins',
    icon: Puzzle,
    roles: ALL_ROLES,
    isComingSoon: true,
  },
];
