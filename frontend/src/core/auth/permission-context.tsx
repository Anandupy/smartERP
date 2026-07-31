"use client";

import { createContext, useContext, useMemo } from "react";

import { useAuth } from "./auth-context";
import type { PermissionContextValue } from "./types";

const PermissionContext = createContext<PermissionContextValue | null>(null);

/**
 * Derives permission-checking helpers from the authenticated user. Kept as its
 * own context so components can subscribe to permission changes without pulling
 * in the whole auth value, and so the checking strategy (flat strings today,
 * possibly policy objects later) can evolve independently.
 */
export function PermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  const value = useMemo<PermissionContextValue>(() => {
    const permissions = user?.permissions ?? [];
    const roles = user?.roles ?? [];
    const permissionSet = new Set(permissions);
    const roleSet = new Set(roles);

    return {
      permissions,
      roles,
      can: (permission) => permissionSet.has(permission),
      canAny: (required) => required.some((p) => permissionSet.has(p)),
      canAll: (required) => required.every((p) => permissionSet.has(p)),
      hasRole: (role) => roleSet.has(role),
    };
  }, [user]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions(): PermissionContextValue {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error(
      "usePermissions must be used within a <PermissionProvider>.",
    );
  }
  return context;
}
