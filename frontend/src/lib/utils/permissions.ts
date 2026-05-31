import type { UserRole } from '@/types/domain.types';

// ── Role Hierarchy ────────────────────────────────────────────

/**
 * Numeric weight for each role.
 * Higher number = more permissions.
 */
const ROLE_WEIGHTS: Record<UserRole, number> = {
  SUPER_ADMIN: 5,
  ORG_ADMIN: 4,
  BRANCH_ADMIN: 3,
  STAFF: 2,
  STUDENT: 1,
  PARENT: 1,
};

/**
 * Check if a role is at least as powerful as the required role.
 */
export function isAtLeast(role: UserRole, required: UserRole): boolean {
  return (ROLE_WEIGHTS[role] ?? 0) >= (ROLE_WEIGHTS[required] ?? 0);
}

/**
 * Check if a role is exactly one of the allowed roles.
 */
export function isOneOf(role: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(role);
}

// ── Permission Map ────────────────────────────────────────────

/**
 * All possible permission strings in EduOS.
 * Add new permissions here as modules are built.
 */
export type Permission =
  // Organization
  | 'org:create'
  | 'org:read'
  | 'org:update'
  | 'org:delete'
  // Branch
  | 'branch:create'
  | 'branch:read'
  | 'branch:update'
  | 'branch:delete'
  | 'branch:status'
  // Academic Year
  | 'academic-year:create'
  | 'academic-year:update'
  | 'academic-year:activate'
  | 'academic-year:select'
  | 'academic-year:lock'
  | 'academic-year:delete'
  // Program
  | 'program:create'
  | 'program:read'
  | 'program:update'
  | 'program:delete'
  | 'program:status'
  // Academic Unit
  | 'unit:create'
  | 'unit:read'
  | 'unit:update'
  | 'unit:move'
  | 'unit:delete'
  | 'unit:assign-students'
  // Admissions
  | 'admissions:create'
  | 'admissions:read'
  | 'admissions:update'
  | 'admissions:approve'
  | 'admissions:reject'
  | 'admissions:cancel'
  // System
  | 'system:init'
  | 'system:read'
  | 'system:update'
  | 'system:maintenance'
  // Theme
  | 'theme:read'
  | 'theme:update'
  | 'theme:publish'
  // Audit
  | 'audit:view'
  | 'audit:export'
  // Users
  | 'users:create'
  | 'users:read'
  | 'users:update'
  | 'users:delete';

/**
 * Permission matrix — maps each permission to the roles that have it.
 * Source of truth for frontend RBAC.
 */
const PERMISSION_MAP: Record<Permission, UserRole[]> = {
  // Organization
  'org:create': ['SUPER_ADMIN'],
  'org:read': ['SUPER_ADMIN', 'ORG_ADMIN'],
  'org:update': ['SUPER_ADMIN', 'ORG_ADMIN'],
  'org:delete': ['SUPER_ADMIN'],
  // Branch
  'branch:create': ['SUPER_ADMIN', 'ORG_ADMIN'],
  'branch:read': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'branch:update': ['SUPER_ADMIN', 'ORG_ADMIN'],
  'branch:delete': ['SUPER_ADMIN'],
  'branch:status': ['SUPER_ADMIN', 'ORG_ADMIN'],
  // Academic Year
  'academic-year:create': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'academic-year:update': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'academic-year:activate': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'academic-year:select': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'academic-year:lock': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'academic-year:delete': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  // Program
  'program:create': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'program:read': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF', 'STUDENT', 'PARENT'],
  'program:update': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'program:delete': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'program:status': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  // Academic Unit
  'unit:create': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'unit:read': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF', 'STUDENT', 'PARENT'],
  'unit:update': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'unit:move': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'unit:delete': ['SUPER_ADMIN', 'ORG_ADMIN'],
  'unit:assign-students': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
  // Admissions
  'admissions:create': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
  'admissions:read': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
  'admissions:update': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF'],
  'admissions:approve': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'admissions:reject': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'admissions:cancel': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  // System
  'system:init': ['SUPER_ADMIN'],
  'system:read': ['SUPER_ADMIN'],
  'system:update': ['SUPER_ADMIN'],
  'system:maintenance': ['SUPER_ADMIN'],
  // Theme
  'theme:read': ['SUPER_ADMIN', 'ORG_ADMIN'],
  'theme:update': ['SUPER_ADMIN', 'ORG_ADMIN'],
  'theme:publish': ['SUPER_ADMIN', 'ORG_ADMIN'],
  // Audit
  'audit:view': ['SUPER_ADMIN', 'ORG_ADMIN'],
  'audit:export': ['SUPER_ADMIN'],
  // Users
  'users:create': ['SUPER_ADMIN', 'ORG_ADMIN'],
  'users:read': ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN'],
  'users:update': ['SUPER_ADMIN', 'ORG_ADMIN'],
  'users:delete': ['SUPER_ADMIN'],
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowed = PERMISSION_MAP[permission];
  return allowed.includes(role);
}

/**
 * Check if a role has ALL of the specified permissions.
 */
export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check if a role has ANY of the specified permissions.
 */
export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Get the default redirect path for a given role after login.
 */
export function getDefaultRedirect(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/administration/organizations';
    case 'ORG_ADMIN':
    case 'BRANCH_ADMIN':
      return '/dashboard';
    case 'STAFF':
      return '/admissions';
    case 'STUDENT':
    case 'PARENT':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}
