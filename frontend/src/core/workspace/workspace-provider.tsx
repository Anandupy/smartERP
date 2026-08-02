"use client";

import { useEffect } from "react";

import { useSession } from "@/core/auth";

import { registerWorkspaceHeaders } from "./workspace-headers";
import { useWorkspaceStore } from "./workspace-store";

/**
 * Lifecycle for the workspace scope. Renders nothing of its own.
 *
 * The scope itself lives in `workspace-store`, so this provider holds no state
 * — duplicating it here is exactly the drift the store exists to prevent. What
 * it owns is the wiring that must be in place before any scoped request goes
 * out:
 *
 * 1. the tenant / branch / academic-year headers resolve from the active
 *    scope, replacing the platform's `null` placeholders;
 * 2. the scope is mirrored into `SessionContext`, which `core/auth` has always
 *    declared as the app's tenant/branch/workspace scope. One writer, one
 *    direction — the session context is a read-only view for its existing
 *    consumers, never a second source of truth.
 *
 * Mounted once in `AppProviders`, inside `SessionProvider`.
 */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { setScope } = useSession();
  const selection = useWorkspaceStore((state) => state.selection);
  const status = useWorkspaceStore((state) => state.status);

  useEffect(() => registerWorkspaceHeaders(), []);

  useEffect(() => {
    // Only a confirmed scope is published, matching what the headers send: a
    // half-made selection must not look like an operating scope to anything.
    const active = status === "ready";
    setScope({
      tenantId: active ? selection.organizationId : null,
      branchId: active ? selection.branchId : null,
      academicYearId: active ? selection.academicYearId : null,
    });
  }, [status, selection, setScope]);

  return <>{children}</>;
}
