'use client';

import { useAuthStore } from '@/stores/auth.store';
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  isAtLeast,
  type Permission,
} from '@/lib/utils/permissions';
import type { UserRole } from '@/types/domain.types';

/**
 * Check if the current user has a specific permission.
 *
 * @example
 * const canCreate = usePermission('org:create');
 * if (!canCreate) return null;
 */
export function usePermission(permission: Permission): boolean {
  const role = useAuthStore((s) => s.role);
  if (!role) return false;
  return hasPermission(role, permission);
}

/**
 * Check if the current user has ALL of the specified permissions.
 */
export function useAllPermissions(permissions: Permission[]): boolean {
  const role = useAuthStore((s) => s.role);
  if (!role) return false;
  return hasAllPermissions(role, permissions);
}

/**
 * Check if the current user has ANY of the specified permissions.
 */
export function useAnyPermission(permissions: Permission[]): boolean {
  const role = useAuthStore((s) => s.role);
  if (!role) return false;
  return hasAnyPermission(role, permissions);
}

/**
 * Returns the current user's role.
 */
export function useRole(): UserRole | null {
  return useAuthStore((s) => s.role);
}

/**
 * Check if the current user's role is at least as powerful as the given role.
 *
 * @example
 * const isAdmin = useIsAtLeast('ORG_ADMIN');
 */
export function useIsAtLeast(role: UserRole): boolean {
  const currentRole = useAuthStore((s) => s.role);
  if (!currentRole) return false;
  return isAtLeast(currentRole, role);
}
